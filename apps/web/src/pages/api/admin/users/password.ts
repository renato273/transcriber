import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import { isPasswordValid, passwordValidationError, getPasswordChecks } from '../../../../lib/password.js';

/**
 * POST /api/admin/users/password
 * Body: { userId, password }
 * El admin define la nueva contraseña del usuario.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const password = body?.password as string | undefined;

    if (!userId || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Faltan userId o password.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isPasswordValid(password)) {
      return new Response(
        JSON.stringify({
          error: passwordValidationError(password) || 'Contraseña inválida',
          checks: getPasswordChecks(password),
        }),
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

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Cerrar sesiones del usuario para forzar re-login con la nueva clave
    // (excepto si el admin se cambia la propia: se mantiene su cookie actual)
    if (userId !== user.id) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Contraseña de ${target.email} actualizada.`,
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
