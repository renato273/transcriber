import type { APIRoute } from 'astro';
import { prisma, decrypt } from '@transcriber/database';
import { AIServiceFactory } from '@transcriber/ai-services';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-123456789012';

export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  const transcriptionId = params.id;

  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!transcriptionId) return Response.json({ error: 'ID de transcripción requerido' }, { status: 400 });

  try {
    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, session: { userId: user.id } },
      select: { id: true, originalText: true, status: true },
    });
    if (!transcription) return Response.json({ error: 'Transcripción no encontrada' }, { status: 404 });
    if (transcription.status !== 'COMPLETED' || !transcription.originalText?.trim()) {
      return Response.json({ error: 'La transcripción no está lista para resumirse' }, { status: 400 });
    }

    const provider = await prisma.aIProvider.findFirst({
      where: { isActive: true, isDefaultTranslation: true },
    });
    if (!provider) {
      return Response.json({ error: 'No hay un proveedor de IA activo configurado para generar resúmenes.' }, { status: 503 });
    }

    const adapter = AIServiceFactory.createAdapter(
      provider.type,
      decrypt(provider.apiKey, ENCRYPTION_KEY),
      provider.baseUrl
    );
    const summary = await adapter.summarizeText(transcription.originalText);
    if (!summary) return Response.json({ error: 'El proveedor no devolvió un resumen.' }, { status: 502 });

    const updated = await prisma.transcription.update({
      where: { id: transcription.id },
      data: { summary, summaryProvider: provider.type },
      select: { id: true, summary: true, summaryProvider: true, updatedAt: true },
    });
    return Response.json({ success: true, transcription: updated });
  } catch (error: any) {
    console.error('Error generando resumen:', error);
    return Response.json({ error: error.message || 'No se pudo generar el resumen' }, { status: 500 });
  }
};
