import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sessionCookieOptions } from '../../../lib/cookies.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

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

export const POST: APIRoute = async ({ request, cookies }) => {
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
        ? redirectWithMessage(request, 'login', { error })
        : jsonResponse({ error }, 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      const error = 'Credenciales inválidas';
      return acceptsHtml
        ? redirectWithMessage(request, 'login', { error })
        : jsonResponse({ error }, 400);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const error = 'Credenciales inválidas';
      return acceptsHtml
        ? redirectWithMessage(request, 'login', { error })
        : jsonResponse({ error }, 400);
    }

    if (!user.isActive) {
      const error = 'Tu cuenta está desactivada. Contacta a un administrador.';
      return acceptsHtml
        ? redirectWithMessage(request, 'login', { error })
        : jsonResponse({ error }, 403);
    }

    // Create session in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt
      }
    });

    // Create JWT
    const token = jwt.sign({ sessionId: session.id }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie (Secure solo en HTTPS; en LAN HTTP no se usa Secure)
    cookies.set('session_id', token, sessionCookieOptions(request, expiresAt));

    if (acceptsHtml) {
      return redirectWithMessage(request, 'dashboard', {});
    }

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, role: user.role }
    }, 200);
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};
