import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import fs from 'fs';
import path from 'path';

const MIME_BY_EXT: Record<string, string> = {
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

/**
 * GET /api/transcriptions/:id/audio
 * Sirve el archivo de audio de una transcripción del usuario dueño.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const transcriptionId = params.id;

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!transcriptionId) {
    return new Response(JSON.stringify({ error: 'ID de transcripción requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const transcription = await prisma.transcription.findFirst({
      where: {
        id: transcriptionId,
        session: { userId: user.id },
      },
      select: {
        id: true,
        audioPath: true,
      },
    });

    if (!transcription) {
      return new Response(JSON.stringify({ error: 'Transcripción no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!transcription.audioPath || !fs.existsSync(transcription.audioPath)) {
      return new Response(JSON.stringify({ error: 'Audio no disponible' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const filePath = transcription.audioPath;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="audio${ext || '.webm'}"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
