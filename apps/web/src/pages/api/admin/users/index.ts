import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';

const userSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function requireAdmin(user: { role: string } | null | undefined) {
  if (!user || user.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

async function countActiveAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      role: 'ADMIN',
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/**
 * GET /api/admin/users
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = requireAdmin(locals.user);
  if (denied) return denied;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        ...userSelect,
        _count: {
          select: { transcriptionSessions: true },
        },
      },
    });

    return new Response(
      JSON.stringify(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          sessionsCount: u._count.transcriptionSessions,
        }))
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
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
 * Body: { userId, role?: 'ADMIN'|'USER', isActive?: boolean }
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const denied = requireAdmin(locals.user);
  if (denied) return denied;

  const currentUser = locals.user!;

  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const role = body?.role as string | undefined;
    const hasIsActive = typeof body?.isActive === 'boolean';
    const isActive = hasIsActive ? (body.isActive as boolean) : undefined;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Falta userId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (role !== undefined && role !== 'ADMIN' && role !== 'USER') {
      return new Response(JSON.stringify({ error: 'role inválido (ADMIN|USER).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (role === undefined && !hasIsActive) {
      return new Response(
        JSON.stringify({ error: 'Envía role y/o isActive para actualizar.' }),
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

    const nextRole = role ?? target.role;
    const nextActive = hasIsActive ? isActive! : target.isActive;

    // Único admin activo no puede perder rol ni desactivarse
    const wouldLoseAdminAccess =
      target.role === 'ADMIN' &&
      target.isActive &&
      (nextRole !== 'ADMIN' || !nextActive);

    if (wouldLoseAdminAccess) {
      const otherActiveAdmins = await countActiveAdmins(target.id);
      if (otherActiveAdmins < 1) {
        return new Response(
          JSON.stringify({
            error:
              'No se puede degradar ni inactivar al único administrador activo del sistema.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const data: { role?: 'ADMIN' | 'USER'; isActive?: boolean } = {};
    if (role !== undefined && role !== target.role) {
      data.role = role as 'ADMIN' | 'USER';
    }
    if (hasIsActive && nextActive !== target.isActive) {
      data.isActive = nextActive;
    }

    if (Object.keys(data).length === 0) {
      return new Response(
        JSON.stringify({
          user: {
            id: target.id,
            email: target.email,
            role: target.role,
            isActive: target.isActive,
            createdAt: target.createdAt,
            updatedAt: target.updatedAt,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: userSelect,
    });

    // Al inactivar: cerrar todas sus sesiones de login
    if (data.isActive === false) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    const selfDemoted =
      currentUser.id === userId && data.role === 'USER' && updated.role === 'USER';
    const selfDeactivated = currentUser.id === userId && data.isActive === false;

    return new Response(
      JSON.stringify({
        user: updated,
        selfDemoted,
        selfDeactivated,
        message: selfDeactivated
          ? 'Tu cuenta fue desactivada. Se cerrará la sesión.'
          : selfDemoted
            ? 'Tu rol ahora es USER. Serás redirigido al panel.'
            : 'Usuario actualizado',
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

/**
 * DELETE /api/admin/users
 * Body: { userId }
 * Eliminación permanente (cascade de sesiones y grabaciones).
 */
export const DELETE: APIRoute = async ({ request, locals }) => {
  const denied = requireAdmin(locals.user);
  if (denied) return denied;

  const currentUser = locals.user!;

  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Falta userId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (userId === currentUser.id) {
      return new Response(
        JSON.stringify({ error: 'No puedes eliminar tu propia cuenta.' }),
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

    if (target.role === 'ADMIN' && target.isActive) {
      const otherActiveAdmins = await countActiveAdmins(target.id);
      if (otherActiveAdmins < 1) {
        return new Response(
          JSON.stringify({
            error: 'No se puede eliminar al único administrador activo. Preferí inactivarlo solo si hay otro admin.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    return new Response(
      JSON.stringify({ success: true, message: `Usuario ${target.email} eliminado.` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
