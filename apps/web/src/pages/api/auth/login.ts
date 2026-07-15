import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email y contraseña requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    // Set cookie
    cookies.set('session_id', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt
    });

    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, email: user.email, role: user.role }
    }), {
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
