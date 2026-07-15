import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import fs from 'fs';

/**
 * DELETE /api/transcriptions/:id
 * Elimina una transcripción (y archivo de audio) del usuario dueño.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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
    });

    if (!transcription) {
      return new Response(JSON.stringify({ error: 'Transcripción no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (transcription.audioPath && fs.existsSync(transcription.audioPath)) {
      try {
        fs.unlinkSync(transcription.audioPath);
      } catch (e) {
        console.error('Error eliminando archivo de audio:', e);
      }
    }

    await prisma.transcription.delete({
      where: { id: transcriptionId },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
