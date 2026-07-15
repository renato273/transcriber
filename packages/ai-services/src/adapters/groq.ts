import OpenAI from 'openai';
import fs from 'fs';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

export class GroqAdapter implements AIServiceInterface {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async transcribeAudio(filePath: string, _mimeType?: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('GROQ', 'transcription');
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model,
        response_format: 'json',
      });

      return response.text;
    } catch (error: any) {
      console.error('Error en Groq Transcription:', error);
      throw new Error(`Groq Falló: ${error.message}`);
    }
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('GROQ', 'translation');
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
      console.error('Error en Groq Translation:', error);
      throw error;
    }
  }
}
