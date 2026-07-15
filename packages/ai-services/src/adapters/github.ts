import OpenAI from 'openai';
import fs from 'fs';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

/**
 * GitHub Models — PAT con scope models:read.
 */
export class GitHubModelsAdapter implements AIServiceInterface {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://models.github.ai/inference',
      defaultHeaders: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  }

  async transcribeAudio(
    filePath: string,
    mimeType: string = 'audio/webm',
    modelId?: string
  ): Promise<string> {
    const model = modelId || getDefaultModelId('GITHUB', 'transcription');
    try {
      const audioBuffer = fs.readFileSync(filePath);
      const base64Audio = audioBuffer.toString('base64');
      const format = mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('mp3') || mimeType.includes('mpeg')
          ? 'mp3'
          : 'wav';

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe el audio adjunto de manera literal y exacta. Devuelve únicamente la transcripción del texto sin comentarios adicionales.',
              },
              {
                type: 'input_audio' as any,
                input_audio: {
                  data: base64Audio,
                  format,
                },
              },
            ] as any,
          },
        ],
        temperature: 0,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error: any) {
      console.error('Error en GitHub Models Transcription:', error);
      throw new Error(
        `GitHub Models Falló: ${error.message}. Asegura un PAT con scope models:read y un modelo con soporte de audio.`
      );
    }
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('GITHUB', 'translation');
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Eres un traductor profesional. Devuelve estrictamente solo la traducción, sin explicaciones.',
          },
          {
            role: 'user',
            content: `Traduce al idioma ISO "${targetLang}":\n\n${text}`,
          },
        ],
        temperature: 0.1,
      });

      return completion.choices[0].message.content?.trim() || '';
    } catch (error: any) {
      console.error('Error en GitHub Models Translation:', error);
      throw error;
    }
  }
}
