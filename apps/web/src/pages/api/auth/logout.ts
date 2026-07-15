import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export const POST: APIRoute = async ({ cookies }) => {
  const sessionToken = cookies.get('session_id')?.value;

  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as { sessionId: string };
      // Delete session from DB
      await prisma.session.delete({
        where: { id: decoded.sessionId }
      }).catch(() => {}); // Ignore error if session already deleted
    } catch (e) {
      // Ignore JWT errors, just delete cookie
    }
  }

  // Delete cookie
  cookies.delete('session_id', { path: '/' });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
