import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import { isPasswordValid, passwordValidationError, getPasswordChecks } from '../../../lib/password.js';

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { currentPassword, password } = await request.json();
    if (typeof currentPassword !== 'string' || typeof password !== 'string') {
      return Response.json({ error: 'Faltan contraseña actual o nueva contraseña.' }, { status: 400 });
    }

    if (!isPasswordValid(password)) {
      return Response.json(
        { error: passwordValidationError(password), checks: getPasswordChecks(password) },
        { status: 400 }
      );
    }

    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (!account) {
      return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const validCurrentPassword = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!validCurrentPassword) {
      return Response.json({ error: 'La contraseña actual es incorrecta.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    cookies.delete('session_id', { path: '/' });

    return Response.json({
      success: true,
      message: 'Contraseña actualizada. Iniciá sesión nuevamente.',
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'No se pudo actualizar la contraseña.' }, { status: 500 });
  }
};
