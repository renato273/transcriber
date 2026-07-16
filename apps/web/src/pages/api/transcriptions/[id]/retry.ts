import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory, PROVIDER_CAPABILITIES } from '@transcriber/ai-services';
import fs from 'fs';
import path from 'path';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

const MIME_BY_EXT: Record<string, string> = {
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

/**
 * POST /api/transcriptions/:id/retry
 * Reintenta la transcripción del audio ya guardado, con el proveedor/modelo indicados.
 * Body: { providerType?, modelId? }
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  const transcriptionId = params.id;

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!transcriptionId) {
    return new Response(JSON.stringify({ error: 'ID de transcripción requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const providerType = (body?.providerType as string | null)?.toUpperCase() || null;
    const modelId = (body?.modelId as string | null)?.trim() || null;

    const transcription = await prisma.transcription.findFirst({
      where: {
        id: transcriptionId,
        session: { userId: user.id },
      },
    });

    if (!transcription) {
      return new Response(JSON.stringify({ error: 'Transcripción no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (transcription.status !== 'FAILED') {
      return new Response(
        JSON.stringify({
          error: 'Solo se pueden reintentar transcripciones con estado Fallido.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!transcription.audioPath || !fs.existsSync(transcription.audioPath)) {
      return new Response(
        JSON.stringify({
          error: 'El archivo de audio ya no está disponible. Subí o grabá el audio de nuevo.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let activeProvider = null;

    if (providerType) {
      const caps = PROVIDER_CAPABILITIES[providerType];
      if (!caps?.supportsTranscription) {
        return new Response(
          JSON.stringify({
            error: `El proveedor ${providerType} no soporta transcripción de audio.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      activeProvider = await prisma.aIProvider.findFirst({
        where: { type: providerType as any, isActive: true },
      });

      if (!activeProvider) {
        return new Response(
          JSON.stringify({
            error: `El proveedor ${providerType} no está activo o no tiene API key configurada.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      activeProvider = await prisma.aIProvider.findFirst({
        where: { isActive: true, isDefaultTranscription: true },
      });

      if (!activeProvider) {
        return new Response(
          JSON.stringify({
            error: 'No hay ningún proveedor de IA activo configurado para transcripción.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    await prisma.transcription.update({
      where: { id: transcription.id },
      data: {
        status: 'PROCESSING',
        errorMessage: null,
        providerUsed: activeProvider.type,
        originalText: null,
      },
    });

    const filePath = transcription.audioPath;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] || 'audio/webm';

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

      const text = await adapter.transcribeAudio(filePath, mimeType, modelId || undefined);

      const updated = await prisma.transcription.update({
        where: { id: transcription.id },
        data: {
          status: 'COMPLETED',
          originalText: text,
          errorMessage: null,
          providerUsed: activeProvider.type,
        },
        include: { translations: true },
      });

      return new Response(
        JSON.stringify({
          success: true,
          transcription: {
            ...updated,
            hasAudio: true,
            audioPath: undefined,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (apiError: any) {
      console.error('Error en reintento de transcripción:', apiError);

      await prisma.transcription.update({
        where: { id: transcription.id },
        data: {
          status: 'FAILED',
          errorMessage: apiError.message || 'Error desconocido del proveedor de IA',
          providerUsed: activeProvider.type,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Falló el reintento de transcripción',
          details: apiError.message,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error en /api/transcriptions/:id/retry:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
