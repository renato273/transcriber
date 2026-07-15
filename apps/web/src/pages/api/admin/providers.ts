import type { APIRoute } from 'astro';
import { prisma, encrypt } from '@transcriber/database';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const providers = await prisma.aIProvider.findMany({
      orderBy: { type: 'asc' }
    });

    // Hide encrypted API Key for security
    const sanitizedProviders = providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? '********' : ''
    }));

    return new Response(JSON.stringify(sanitizedProviders), {
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

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { type, name, apiKey, baseUrl, isActive, isDefaultTranscription, isDefaultTranslation } = await request.json();

    if (!type || !name) {
      return new Response(JSON.stringify({ error: 'Faltan campos type o name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Encrypt key if provided, otherwise retrieve existing one if editing
    let finalApiKey = '';
    if (apiKey && apiKey !== '********') {
      finalApiKey = encrypt(apiKey, ENCRYPTION_KEY);
    } else {
      const existing = await prisma.aIProvider.findUnique({ where: { type } });
      if (existing) {
        finalApiKey = existing.apiKey;
      } else {
        return new Response(JSON.stringify({ error: 'La API Key es requerida para un proveedor nuevo' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const normalizedBaseUrl =
      typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim().replace(/\/$/, '') : null;

    // Handle defaults logic
    if (isDefaultTranscription) {
      // Unset other defaults
      await prisma.aIProvider.updateMany({
        data: { isDefaultTranscription: false }
      });
    }
    if (isDefaultTranslation) {
      // Unset other defaults
      await prisma.aIProvider.updateMany({
        data: { isDefaultTranslation: false }
      });
    }

    // Upsert provider
    const provider = await prisma.aIProvider.upsert({
      where: { type },
      update: {
        name,
        apiKey: finalApiKey,
        baseUrl: normalizedBaseUrl,
        isActive: !!isActive,
        isDefaultTranscription: !!isDefaultTranscription,
        isDefaultTranslation: !!isDefaultTranslation
      },
      create: {
        type,
        name,
        apiKey: finalApiKey,
        baseUrl: normalizedBaseUrl,
        isActive: !!isActive,
        isDefaultTranscription: !!isDefaultTranscription,
        isDefaultTranslation: !!isDefaultTranslation
      }
    });

    return new Response(JSON.stringify({
      success: true,
      provider: { ...provider, apiKey: '********' }
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
