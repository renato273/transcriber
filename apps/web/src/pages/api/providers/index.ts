import type { APIRoute } from 'astro';
import { prisma } from '@transcriber/database';
import { PROVIDER_CAPABILITIES } from '@transcriber/ai-services';

/**
 * Lista proveedores activos (sin API keys) para el selector del dashboard.
 * Query: ?capability=transcription|translation
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const capability = url.searchParams.get('capability') || 'transcription';

    const providers = await prisma.aIProvider.findMany({
      where: { isActive: true },
      orderBy: { type: 'asc' },
      select: {
        type: true,
        name: true,
        isDefaultTranscription: true,
        isDefaultTranslation: true,
      },
    });

    const filtered = providers
      .map((p) => {
        const caps = PROVIDER_CAPABILITIES[p.type] || {
          supportsTranscription: false,
          supportsTranslation: false,
          label: p.name,
        };
        return {
          type: p.type,
          name: p.name || caps.label,
          label: caps.label,
          supportsTranscription: caps.supportsTranscription,
          supportsTranslation: caps.supportsTranslation,
          isDefaultTranscription: p.isDefaultTranscription,
          isDefaultTranslation: p.isDefaultTranslation,
        };
      })
      .filter((p) => {
        if (capability === 'translation') return p.supportsTranslation;
        return p.supportsTranscription;
      });

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
