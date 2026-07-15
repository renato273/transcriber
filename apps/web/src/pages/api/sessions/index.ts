import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const sessions = await prisma.transcriptionSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return new Response(JSON.stringify(sessions), {
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

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { title } = await request.json();

    if (!title || title.trim() === '') {
      return new Response(JSON.stringify({ error: 'Título requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = await prisma.transcriptionSession.create({
      data: {
        userId: user.id,
        title: title.trim()
      }
    });

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
