import type { APIRoute } from 'astro';
import { isRegistrationOpen } from '../../../lib/registration.js';

/**
 * GET /api/auth/registration-status
 * Público: indica si se pueden crear cuentas nuevas.
 */
export const GET: APIRoute = async () => {
  try {
    const status = await isRegistrationOpen();
    return new Response(
      JSON.stringify({
        open: status.open,
        needsBootstrap: status.needsBootstrap,
        message: status.needsBootstrap
          ? 'Creá el primer administrador del sistema.'
          : status.open
            ? 'El registro de nuevos usuarios está habilitado.'
            : 'El registro está cerrado. Pedile a un administrador que lo habilite.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, open: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
