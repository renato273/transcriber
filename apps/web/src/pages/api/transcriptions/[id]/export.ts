import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';

function fileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'transcripcion';
}

function formatSrtTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1_000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(milliseconds % 1_000).padStart(3, '0')}`;
}

function buildSrt(text: string, duration: number | null) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const totalDuration = duration || Math.max(paragraphs.length * 4, 4);
  return paragraphs.map((paragraph, index) => {
    const start = totalDuration * index / paragraphs.length;
    const end = totalDuration * (index + 1) / paragraphs.length;
    return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${paragraph}`;
  }).join('\n\n');
}

export const GET: APIRoute = async ({ params, locals, url }) => {
  const user = locals.user;
  const transcriptionId = params.id;
  const format = url.searchParams.get('format');

  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!transcriptionId || !['txt', 'srt'].includes(format || '')) {
    return Response.json({ error: 'Formato inválido. Usá txt o srt.' }, { status: 400 });
  }

  try {
    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, session: { userId: user.id } },
      select: { id: true, originalText: true, duration: true, createdAt: true },
    });
    if (!transcription) return Response.json({ error: 'Transcripción no encontrada' }, { status: 404 });
    if (!transcription.originalText?.trim()) return Response.json({ error: 'La transcripción no tiene texto para exportar' }, { status: 400 });

    const content = format === 'srt'
      ? buildSrt(transcription.originalText, transcription.duration)
      : transcription.originalText;
    const name = `${fileName(`transcripcion-${transcription.createdAt.toISOString().slice(0, 10)}`)}.${format}`;

    return new Response(content, {
      headers: {
        'Content-Type': format === 'srt' ? 'application/x-subrip; charset=utf-8' : 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'No se pudo exportar la transcripción' }, { status: 500 });
  }
};
