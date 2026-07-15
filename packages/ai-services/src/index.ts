export * from './adapters/gemini.js';
export * from './adapters/nvidia.js';
export * from './adapters/openrouter.js';
export * from './adapters/mistral.js';
export * from './adapters/groq.js';
export * from './adapters/github.js';
export * from './factory.js';
export * from './listModels.js';

export interface AIServiceInterface {
  transcribeAudio(filePath: string, mimeType?: string, modelId?: string): Promise<string>;
  translateText(text: string, targetLang: string, modelId?: string): Promise<string>;
}
