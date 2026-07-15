export * from './adapters/gemini.js';
export * from './adapters/nvidia.js';
export * from './adapters/openrouter.js';
export * from './factory.js';
export interface AIServiceInterface {
  transcribeAudio(filePath: string, mimeType?: string): Promise<string>;
  translateText(text: string, targetLang: string): Promise<string>;
}
