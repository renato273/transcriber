import OpenAI from 'openai';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

export class OpenRouterAdapter implements AIServiceInterface {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/renatocr/transcriber',
        'X-Title': 'AI Audio Transcriber',
      },
    });
  }

  async transcribeAudio(): Promise<string> {
    throw new Error(
      'La transcripción de audio no está soportada en el adaptador gratuito de OpenRouter.'
    );
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('OPENROUTER', 'translation');
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Eres un traductor profesional. Traduce el texto al idioma solicitado. Devuelve estrictamente solo la traducción, sin textos introductorios ni explicaciones.',
          },
          {
            role: 'user',
            content: `Idioma destino: ${targetLang}\n\nTexto:\n${text}`,
          },
        ],
        temperature: 0.2,
      });

      return response.choices[0].message.content?.trim() || '';
    } catch (error: any) {
      console.error('Error en OpenRouter Translation:', error);
      throw error;
    }
  }
}
