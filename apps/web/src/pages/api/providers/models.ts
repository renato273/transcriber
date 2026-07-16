import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { listFreeModels } from '@transcriber/ai-services';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

/**
 * GET /api/providers/models?type=GOOGLE&capability=transcription
 * Lista modelos free del proveedor activo configurado.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const type = (url.searchParams.get('type') || '').toUpperCase();
  const capability = (url.searchParams.get('capability') || 'transcription') as
    | 'transcription'
    | 'translation';

  if (!type) {
    return new Response(JSON.stringify({ error: 'Falta el parámetro type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const provider = await prisma.aIProvider.findFirst({
      where: { type: type as any, isActive: true },
    });

    if (!provider) {
      return new Response(
        JSON.stringify({
          error: `No hay un proveedor ${type} activo configurado.`,
          models: [],
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let apiKey: string;
    try {
      apiKey = decrypt(provider.apiKey, ENCRYPTION_KEY);
    } catch {
      return new Response(
        JSON.stringify({
          error:
            'No se pudo desencriptar la API key. La ENCRYPTION_KEY cambió o la clave está corrupta. Vuelve a guardarla en Administración → API Keys.',
          models: [],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const models = await listFreeModels(type, apiKey, capability);

    return new Response(
      JSON.stringify({
        provider: type,
        capability,
        models,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error listando modelos:', error);
    return new Response(JSON.stringify({ error: error.message, models: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
