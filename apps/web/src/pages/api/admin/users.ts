import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';

function requireAdmin(user: { role: string } | null | undefined) {
  if (!user || user.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/**
 * GET /api/admin/users
 * Lista usuarios (sin passwordHash).
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = requireAdmin(locals.user);
  if (denied) return denied;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transcriptionSessions: true,
          },
        },
      },
    });

    return new Response(
      JSON.stringify(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          sessionsCount: u._count.transcriptionSessions,
        }))
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PATCH /api/admin/users
 * Body: { userId, role: 'ADMIN' | 'USER' }
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const denied = requireAdmin(locals.user);
  if (denied) return denied;

  const currentUser = locals.user!;

  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const role = body?.role as string | undefined;

    if (!userId || (role !== 'ADMIN' && role !== 'USER')) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos. Envía userId y role (ADMIN|USER).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (target.role === role) {
      return new Response(
        JSON.stringify({
          user: {
            id: target.id,
            email: target.email,
            role: target.role,
            createdAt: target.createdAt,
            updatedAt: target.updatedAt,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // No permitir dejar el sistema sin ningún ADMIN
    if (target.role === 'ADMIN' && role === 'USER') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return new Response(
          JSON.stringify({
            error: 'No se puede quitar el rol ADMIN al único administrador del sistema.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Si el admin se auto-degradó, el cliente deberá redirigir
    const selfDemoted = currentUser.id === userId && role === 'USER';

    return new Response(
      JSON.stringify({
        user: updated,
        selfDemoted,
        message: selfDemoted
          ? 'Tu rol ahora es USER. Serás redirigido al panel.'
          : 'Rol actualizado',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
