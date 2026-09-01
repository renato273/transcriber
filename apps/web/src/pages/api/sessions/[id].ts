import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import fs from 'fs';

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const sessionId = params.id;

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'ID de sesión requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const session = await prisma.transcriptionSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      },
      include: {
        transcriptions: {
          orderBy: { createdAt: 'desc' },
          include: {
            translations: true
          }
        }
      }
    });

    if (!session) {
      return new Response(JSON.stringify({ error: 'Sesión no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const safeSession = {
      ...session,
      transcriptions: session.transcriptions.map(({ audioPath, ...rest }) => ({
        ...rest,
        hasAudio: !!(audioPath && fs.existsSync(audioPath)),
      })),
    };

    return new Response(JSON.stringify(safeSession), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  const sessionId = params.id;

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!sessionId) {
    return Response.json({ error: 'ID de sesión requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data: { title?: string; isFavorite?: boolean; tags?: string[] } = {};

    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) return Response.json({ error: 'Título requerido' }, { status: 400 });
      data.title = title;
    }
    if (typeof body.isFavorite === 'boolean') data.isFavorite = body.isFavorite;
    if (Array.isArray(body.tags)) {
      data.tags = [...new Set(body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean))].slice(0, 12);
    }

    if (!Object.keys(data).length) {
      return Response.json({ error: 'No hay cambios para guardar' }, { status: 400 });
    }

    const session = await prisma.transcriptionSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true },
    });
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });

    const updatedSession = await prisma.transcriptionSession.update({
      where: { id: session.id },
      data,
    });
    return Response.json(updatedSession);
  } catch (error: any) {
    return Response.json({ error: error.message || 'No se pudo actualizar la sesión' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const sessionId = params.id;

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'ID de sesión requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Confirm session ownership
    const session = await prisma.transcriptionSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      },
      include: {
        transcriptions: true
      }
    });

    if (!session) {
      return new Response(JSON.stringify({ error: 'Sesión no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete associated physical files
    for (const transcription of session.transcriptions) {
      if (transcription.audioPath && fs.existsSync(transcription.audioPath)) {
        try {
          fs.unlinkSync(transcription.audioPath);
        } catch (e) {
          console.error(`Error eliminando archivo físico de audio: ${transcription.audioPath}`, e);
        }
      }
    }

    // Delete session from DB (cascades transcriptions and translations)
    await prisma.transcriptionSession.delete({
      where: { id: sessionId }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
