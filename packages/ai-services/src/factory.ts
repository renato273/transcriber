import { GeminiAdapter } from './adapters/gemini.js';
import { NvidiaAdapter } from './adapters/nvidia.js';
import { OpenRouterAdapter } from './adapters/openrouter.js';
import { MistralAdapter } from './adapters/mistral.js';
import { GroqAdapter } from './adapters/groq.js';
import { GitHubModelsAdapter } from './adapters/github.js';
import type { AIServiceInterface } from './index.js';

/** Capacidades por tipo de proveedor (sin exponer secretos). */
export const PROVIDER_CAPABILITIES: Record<
  string,
  { supportsTranscription: boolean; supportsTranslation: boolean; label: string }
> = {
  GOOGLE: { supportsTranscription: true, supportsTranslation: true, label: 'Google Gemini' },
  NVIDIA: { supportsTranscription: true, supportsTranslation: true, label: 'NVIDIA NIM' },
  OPENROUTER: { supportsTranscription: false, supportsTranslation: true, label: 'OpenRouter' },
  MISTRAL: { supportsTranscription: true, supportsTranslation: true, label: 'Mistral AI' },
  GROQ: { supportsTranscription: true, supportsTranslation: true, label: 'Groq' },
  GITHUB: { supportsTranscription: true, supportsTranslation: true, label: 'GitHub Models' },
};

export class AIServiceFactory {
  /**
   * Instantiates the correct AI adapter.
   * @param baseUrl - Opcional (p.ej. NIM autohospedado para NVIDIA)
   */
  static createAdapter(
    type: string,
    decryptedApiKey: string,
    baseUrl?: string | null
  ): AIServiceInterface {
    switch (type.toUpperCase()) {
      case 'GOOGLE':
        return new GeminiAdapter(decryptedApiKey);
      case 'NVIDIA':
        return new NvidiaAdapter(decryptedApiKey, baseUrl);
      case 'OPENROUTER':
        return new OpenRouterAdapter(decryptedApiKey);
      case 'MISTRAL':
        return new MistralAdapter(decryptedApiKey);
      case 'GROQ':
        return new GroqAdapter(decryptedApiKey);
      case 'GITHUB':
        return new GitHubModelsAdapter(decryptedApiKey);
      default:
        throw new Error(`Proveedor de IA no reconocido: ${type}`);
    }
  }
}
