import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import { isPasswordValid, passwordValidationError } from '../../../lib/password.js';
import {
  isRegistrationOpen,
  closeRegistrationAfterBootstrap,
} from '../../../lib/registration.js';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirectWithMessage(request: Request, path: string, params: Record<string, string>) {
  const url = new URL(`${import.meta.env.BASE_URL}${path}`, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return Response.redirect(url, 302);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const acceptsHtml = (request.headers.get('accept') ?? '').includes('text/html');

    let email = '';
    let password = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = (body?.email ?? '').toString().trim().toLowerCase();
      password = (body?.password ?? '').toString();
    } else {
      const formData = await request.formData();
      email = (formData.get('email') ?? '').toString().trim().toLowerCase();
      password = (formData.get('password') ?? '').toString();
    }

    if (!email || !password) {
      const error = 'Email y contraseña requeridos';
      return acceptsHtml
        ? redirectWithMessage(request, 'register', { error })
        : jsonResponse({ error }, 400);
    }

    if (!isPasswordValid(password)) {
      const error = passwordValidationError(password);
      return acceptsHtml
        ? redirectWithMessage(request, 'register', { error })
        : jsonResponse({ error }, 400);
    }

    const status = await isRegistrationOpen();
    if (!status.open) {
      const error =
        'El registro de nuevos usuarios está deshabilitado. Contactá a un administrador.';
      return acceptsHtml
        ? redirectWithMessage(request, 'register', { error })
        : jsonResponse({ error }, 403);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const error = 'El usuario ya existe';
      return acceptsHtml
        ? redirectWithMessage(request, 'register', { error })
        : jsonResponse({ error }, 400);
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

    const message = isFirstUser
      ? 'Administrador creado. El registro público quedó cerrado; podés reabrirlo en Administración.'
      : 'Cuenta creada con éxito.';

    if (acceptsHtml) {
      return redirectWithMessage(request, 'login', { registered: '1', message });
    }

    return jsonResponse(
      {
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        registrationClosed: isFirstUser,
        message: isFirstUser ? message : undefined,
      },
      201
    );
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};
