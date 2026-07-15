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

    return new Response(JSON.stringify(session), {
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
