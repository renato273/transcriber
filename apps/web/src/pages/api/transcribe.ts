import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory, PROVIDER_CAPABILITIES } from '@transcriber/ai-services';
import fs from 'fs';
import path from 'path';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';
const STORAGE_DIR = process.env.AUDIO_STORAGE_PATH || './storage/audio';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const inputLanguage = (formData.get('language') as string | null) || 'es';
    const providerType = (formData.get('providerType') as string | null)?.toUpperCase() || null;
    const modelId = (formData.get('modelId') as string | null)?.trim() || null;

    if (!audioFile || !sessionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos de audio o sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = await prisma.transcriptionSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      }
    });

    if (!session) {
      return new Response(JSON.stringify({ error: 'Sesión no encontrada o no autorizada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let activeProvider = null;

    if (providerType) {
      const caps = PROVIDER_CAPABILITIES[providerType];
      if (!caps?.supportsTranscription) {
        return new Response(JSON.stringify({
          error: `El proveedor ${providerType} no soporta transcripción de audio.`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      activeProvider = await prisma.aIProvider.findFirst({
        where: {
          type: providerType as any,
          isActive: true,
        }
      });

      if (!activeProvider) {
        return new Response(JSON.stringify({
          error: `El proveedor ${providerType} no está activo o no tiene API key configurada.`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      activeProvider = await prisma.aIProvider.findFirst({
        where: {
          isActive: true,
          isDefaultTranscription: true
        }
      });

      if (!activeProvider) {
        return new Response(JSON.stringify({
          error: 'No hay ningún proveedor de IA activo configurado para transcripción. Contacta al administrador.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const fileExtension = audioFile.name ? path.extname(audioFile.name) : '.webm';
    const fileName = `${user.id}_${sessionId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(STORAGE_DIR, fileName);

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const dbTranscription = await prisma.transcription.create({
      data: {
        sessionId: session.id,
        audioPath: filePath,
        status: 'PROCESSING',
        language: inputLanguage,
        providerUsed: activeProvider.type
      }
    });

    let text = '';
    try {
      let apiKey: string;
      try {
        apiKey = decrypt(activeProvider.apiKey, ENCRYPTION_KEY);
      } catch {
        throw new Error(
          'No se pudo desencriptar la API key. Vuelve a guardarla en Administración → API Keys.'
        );
      }
      const adapter = AIServiceFactory.createAdapter(
        activeProvider.type,
        apiKey,
        activeProvider.baseUrl
      );

      const mimeType = audioFile.type || 'audio/webm';
      text = await adapter.transcribeAudio(filePath, mimeType, modelId || undefined);

      await prisma.transcription.update({
        where: { id: dbTranscription.id },
        data: {
          status: 'COMPLETED',
          originalText: text,
        }
      });
    } catch (apiError: any) {
      console.error("Error durante llamada a proveedor de IA:", apiError);

      await prisma.transcription.update({
        where: { id: dbTranscription.id },
        data: {
          status: 'FAILED',
          errorMessage: apiError.message || 'Error desconocido del proveedor de IA'
        }
      });

      return new Response(JSON.stringify({
        error: 'Falló el servicio de transcripción de IA',
        details: apiError.message
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transcription: {
        id: dbTranscription.id,
        status: 'COMPLETED',
        originalText: text,
        language: inputLanguage,
        providerUsed: activeProvider.type,
        modelId: modelId || null,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error en endpoint /api/transcribe:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
