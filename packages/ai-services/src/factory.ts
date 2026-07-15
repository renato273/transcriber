import { GeminiAdapter } from './adapters/gemini.js';
import { NvidiaAdapter } from './adapters/nvidia.js';
import { OpenRouterAdapter } from './adapters/openrouter.js';
import type { AIServiceInterface } from './index.js';

export class AIServiceFactory {
  /**
   * Instantiates the correct AI adapter.
   * @param type - 'GOOGLE' | 'NVIDIA' | 'OPENROUTER'
   * @param decryptedApiKey - Decrypted API key from the database
   * @param baseUrl - Optional custom endpoint URL
   */
  static createAdapter(type: string, decryptedApiKey: string): AIServiceInterface {
    switch (type.toUpperCase()) {
      case 'GOOGLE':
        return new GeminiAdapter(decryptedApiKey);
      case 'NVIDIA':
        return new NvidiaAdapter(decryptedApiKey);
      case 'OPENROUTER':
        return new OpenRouterAdapter(decryptedApiKey);
      default:
        throw new Error(`Proveedor de IA no reconocido: ${type}`);
    }
  }
}
