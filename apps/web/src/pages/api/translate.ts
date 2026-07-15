import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory } from '@transcriber/ai-services';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { transcriptionId, targetLanguage } = await request.json();

    if (!transcriptionId || !targetLanguage) {
      return new Response(JSON.stringify({ error: 'Faltan datos de transcriptionId o targetLanguage' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Validate transcription ownership
    const transcription = await prisma.transcription.findUnique({
      where: { id: transcriptionId },
      include: {
        session: true
      }
    });

    if (!transcription || transcription.session.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Transcripción no encontrada o no autorizada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (transcription.status !== 'COMPLETED' || !transcription.originalText) {
      return new Response(JSON.stringify({ error: 'La transcripción no está lista para traducirse' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Check if this translation already exists in DB
    const existingTranslation = await prisma.translation.findFirst({
      where: {
        transcriptionId,
        targetLanguage
      }
    });

    if (existingTranslation) {
      return new Response(JSON.stringify({
        success: true,
        translation: existingTranslation
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Fetch active translation provider
    const activeProvider = await prisma.aIProvider.findFirst({
      where: {
        isActive: true,
        isDefaultTranslation: true
      }
    });

    if (!activeProvider) {
      return new Response(JSON.stringify({ 
        error: 'No hay ningún proveedor de IA activo configurado para traducción. Contacta al administrador.' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Decrypt API Key and translate
    const apiKey = decrypt(activeProvider.apiKey, ENCRYPTION_KEY);
    const adapter = AIServiceFactory.createAdapter(activeProvider.type, apiKey);

    const translatedText = await adapter.translateText(transcription.originalText, targetLanguage);

    // 5. Store in DB
    const translation = await prisma.translation.create({
      data: {
        transcriptionId,
        targetLanguage,
        translatedText,
        providerUsed: activeProvider.type
      }
    });

    return new Response(JSON.stringify({
      success: true,
      translation
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error en endpoint /api/translate:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
