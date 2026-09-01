import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';

function escapeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'transcripcion';
}

function formatSrtTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1_000);
  const remainder = milliseconds % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(remainder).padStart(3, '0')}`;
}

function buildSrt(transcriptions: Array<{ originalText: string | null; duration: number | null }>) {
  const duration = transcriptions.reduce((total, transcription) => total + (transcription.duration || 0), 0);
  const paragraphs = transcriptions
    .flatMap((transcription) => (transcription.originalText || '').split(/\n{2,}/))
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const totalDuration = duration || Math.max(paragraphs.length * 4, 4);
  return paragraphs
    .map((paragraph, index) => {
      const start = (totalDuration * index) / paragraphs.length;
      const end = (totalDuration * (index + 1)) / paragraphs.length;
      return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${paragraph}`;
    })
    .join('\n\n');
}

export const GET: APIRoute = async ({ params, locals, url }) => {
  const user = locals.user;
  const sessionId = params.id;
  const format = url.searchParams.get('format');

  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!sessionId || !['txt', 'srt'].includes(format || '')) {
    return Response.json({ error: 'Formato inválido. Usá txt o srt.' }, { status: 400 });
  }

  try {
    const session = await prisma.transcriptionSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        transcriptions: {
          where: { status: 'COMPLETED', originalText: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { originalText: true, duration: true },
        },
      },
    });

    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    if (!session.transcriptions.length) {
      return Response.json({ error: 'La sesión no tiene transcripciones completadas' }, { status: 400 });
    }

    const content = format === 'srt'
      ? buildSrt(session.transcriptions)
      : session.transcriptions.map((transcription) => transcription.originalText?.trim()).filter(Boolean).join('\n\n');
    const fileName = `${escapeFileName(session.title)}.${format}`;

    return new Response(content, {
      headers: {
        'Content-Type': format === 'srt' ? 'application/x-subrip; charset=utf-8' : 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'No se pudo exportar la sesión' }, { status: 500 });
  }
};
