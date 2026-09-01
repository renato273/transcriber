import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import fs from 'fs';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  const transcriptionId = params.id;

  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!transcriptionId) return Response.json({ error: 'ID de transcripción requerido' }, { status: 400 });

  try {
    const { originalText } = await request.json();
    if (typeof originalText !== 'string' || !originalText.trim()) {
      return Response.json({ error: 'El texto de la transcripción no puede estar vacío.' }, { status: 400 });
    }

    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, session: { userId: user.id } },
      select: { id: true, status: true },
    });
    if (!transcription) return Response.json({ error: 'Transcripción no encontrada' }, { status: 404 });
    if (transcription.status !== 'COMPLETED') {
      return Response.json({ error: 'Solo podés editar transcripciones completadas.' }, { status: 400 });
    }

    const updated = await prisma.transcription.update({
      where: { id: transcription.id },
      data: { originalText: originalText.trim(), summary: null, summaryProvider: null },
      select: { id: true, originalText: true, summary: true, summaryProvider: true, updatedAt: true },
    });
    return Response.json({ success: true, transcription: updated });
  } catch (error: any) {
    return Response.json({ error: error.message || 'No se pudo guardar la transcripción' }, { status: 500 });
  }
};

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
