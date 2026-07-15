import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory } from '@transcriber/ai-services';
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

    if (!audioFile || !sessionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos de audio o sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Validate session ownership
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

    // 2. Fetch the active transcription provider
    const activeProvider = await prisma.aIProvider.findFirst({
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

    // 3. Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // 4. Save file to disk
    const fileExtension = audioFile.name ? path.extname(audioFile.name) : '.webm';
    const fileName = `${user.id}_${sessionId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(STORAGE_DIR, fileName);

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // 5. Create draft in database
    const dbTranscription = await prisma.transcription.create({
      data: {
        sessionId: session.id,
        audioPath: filePath,
        status: 'PROCESSING',
        language: inputLanguage,
        providerUsed: activeProvider.type
      }
    });

    // 6. Decrypt API key and transcribe
    let text = '';
    try {
      const apiKey = decrypt(activeProvider.apiKey, ENCRYPTION_KEY);
      const adapter = AIServiceFactory.createAdapter(activeProvider.type, apiKey);
      
      const mimeType = audioFile.type || 'audio/webm';
      text = await adapter.transcribeAudio(filePath, mimeType);

      // Update success in DB
      await prisma.transcription.update({
        where: { id: dbTranscription.id },
        data: {
          status: 'COMPLETED',
          originalText: text,
        }
      });
    } catch (apiError: any) {
      console.error("Error durante llamada a proveedor de IA:", apiError);
      
      // Update fail status in DB
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
        providerUsed: activeProvider.type
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
