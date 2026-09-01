import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory } from '@transcriber/ai-services';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const sessionId = params.id;

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!sessionId) {
    return Response.json({ error: 'ID de sesión requerido' }, { status: 400 });
  }

  try {
    const session = await prisma.transcriptionSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        transcriptions: {
          where: { status: 'COMPLETED', originalText: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { originalText: true },
        },
      },
    });

    if (!session) {
      return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    const transcript = session.transcriptions
      .map((transcription) => transcription.originalText?.trim())
      .filter(Boolean)
      .join('\n\n');

    if (!transcript) {
      return Response.json({ error: 'La sesión no tiene transcripciones completadas' }, { status: 400 });
    }

    const provider = await prisma.aIProvider.findFirst({
      where: { isActive: true, isDefaultTranslation: true },
    });

    if (!provider) {
      return Response.json(
        { error: 'No hay un proveedor de IA activo configurado para generar resúmenes.' },
        { status: 503 }
      );
    }

    const apiKey = decrypt(provider.apiKey, ENCRYPTION_KEY);
    const adapter = AIServiceFactory.createAdapter(provider.type, apiKey, provider.baseUrl);
    const summary = await adapter.summarizeText(transcript);

    if (!summary) {
      return Response.json({ error: 'El proveedor no devolvió un resumen.' }, { status: 502 });
    }

    const updatedSession = await prisma.transcriptionSession.update({
      where: { id: session.id },
      data: { summary, summaryProvider: provider.type },
      select: { id: true, summary: true, summaryProvider: true, updatedAt: true },
    });

    return Response.json({ success: true, session: updatedSession });
  } catch (error: any) {
    console.error('Error generando resumen:', error);
    return Response.json({ error: error.message || 'No se pudo generar el resumen' }, { status: 500 });
  }
};
