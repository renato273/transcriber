import OpenAI from 'openai';
import fs from 'fs';
import type { AIServiceInterface } from '../index.js';

export class NvidiaAdapter implements AIServiceInterface {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
  }

  async transcribeAudio(filePath: string): Promise<string> {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'nvidia/whisper-large-v3',
        response_format: 'verbose_json',
      });

      return response.text;
    } catch (error: any) {
      console.error("Error en Nvidia Whisper NIM:", error);
      throw new Error(`Nvidia NIM Falló: ${error.message}`);
    }
  }

  async translateText(text: string, targetLang: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'meta/llama3-8b-instruct',
        messages: [
          {
            role: 'user',
            content: `Traduce al idioma "${targetLang}". Retorna única y exclusivamente la traducción:\n\n${text}`
          }
        ],
        temperature: 0.1,
      });

      return completion.choices[0].message.content?.trim() || '';
    } catch (error: any) {
      console.error("Error en Nvidia NIM Translation:", error);
      throw error;
    }
  }
}
