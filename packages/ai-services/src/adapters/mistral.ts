import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

export class MistralAdapter implements AIServiceInterface {
  private apiKey: string;
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.mistral.ai/v1',
    });
  }

  async transcribeAudio(
    filePath: string,
    mimeType: string = 'audio/webm',
    modelId?: string
  ): Promise<string> {
    const model = modelId || getDefaultModelId('MISTRAL', 'transcription');
    try {
      const form = new FormData();
      const buffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath) || 'audio.webm';
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      form.append('file', blob, fileName);
      form.append('model', model);

      const res = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data = await res.json();
      return (data.text || data.transcription || '').trim();
    } catch (error: any) {
      console.error('Error en Mistral Transcription:', error);
      throw new Error(`Mistral Falló: ${error.message}`);
    }
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('MISTRAL', 'translation');
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
      console.error('Error en Mistral Translation:', error);
      throw error;
    }
  }
}
