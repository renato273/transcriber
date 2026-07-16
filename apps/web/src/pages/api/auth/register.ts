import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import { isPasswordValid, passwordValidationError } from '../../../lib/password.js';
import {
  isRegistrationOpen,
  closeRegistrationAfterBootstrap,
} from '../../../lib/registration.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email y contraseña requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isPasswordValid(password)) {
      return new Response(JSON.stringify({ error: passwordValidationError(password) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = await isRegistrationOpen();
    if (!status.open) {
      return new Response(
        JSON.stringify({
          error:
            'El registro de nuevos usuarios está deshabilitado. Contactá a un administrador.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'El usuario ya existe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isFirstUser = status.needsBootstrap;
    const role = isFirstUser ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });

    if (isFirstUser) {
      await closeRegistrationAfterBootstrap();
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        registrationClosed: isFirstUser,
        message: isFirstUser
          ? 'Administrador creado. El registro público quedó cerrado; podés reabrirlo en Administración.'
          : undefined,
      }),
      {
        status: 201,
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
