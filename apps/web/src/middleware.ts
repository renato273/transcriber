import { defineMiddleware } from 'astro:middleware';
import jwt from 'jsonwebtoken';
import { prisma } from '@transcriber/database';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionToken = context.cookies.get('session_id')?.value;

  context.locals.user = null;

  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as { sessionId: string };
      
      const dbSession = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true }
      });

      if (dbSession && dbSession.expiresAt > new Date()) {
        context.locals.user = {
          id: dbSession.user.id,
          email: dbSession.user.email,
          role: dbSession.user.role,
        };
      } else {
        context.cookies.delete('session_id', { path: '/' });
      }
    } catch (e) {
      context.cookies.delete('session_id', { path: '/' });
    }
  }

  const url = new URL(context.request.url);
  const isPublicPath = url.pathname === '/' || url.pathname === '/login' || url.pathname === '/register';
  const isApi = url.pathname.startsWith('/api/');

  // Redirect to login if accessing protected route without session
  if (!context.locals.user && !isPublicPath && !isApi) {
    return context.redirect('/login');
  }

  // Admin pages + APIs: solo ADMIN
  if (
    (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) &&
    context.locals.user?.role !== 'ADMIN'
  ) {
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect(context.locals.user ? '/dashboard' : '/login');
  }

  return next();
});
