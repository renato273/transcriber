import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

export class GeminiAdapter implements AIServiceInterface {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async transcribeAudio(
    filePath: string,
    mimeType: string = 'audio/webm',
    modelId?: string
  ): Promise<string> {
    const model = modelId || getDefaultModelId('GOOGLE', 'transcription');
    try {
      const audioBuffer = fs.readFileSync(filePath);
      const base64Audio = audioBuffer.toString('base64');

      const response = await this.ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: 'Transcribe el audio adjunto de manera literal y exacta. Devuelve únicamente la transcripción del texto sin comentarios adicionales.',
              },
            ],
          },
        ],
      });

      return response.text?.trim() || '';
    } catch (error: any) {
      console.error('Error en Gemini Transcription:', error);
      throw new Error(`Gemini Falló: ${error.message}`);
    }
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('GOOGLE', 'translation');
    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: `Traduce el siguiente texto al idioma especificado por el código de idioma ISO: "${targetLang}". 
Devuelve única y exclusivamente el texto traducido final, sin explicaciones ni notas de traducción:

Texto a traducir:
${text}`,
      });

      return response.text?.trim() || '';
    } catch (error: any) {
      console.error('Error en Gemini Translation:', error);
      throw error;
    }
  }
}
