export interface ListedModel {
  id: string;
  name: string;
  isFree: boolean;
  supportsTranscription: boolean;
  supportsTranslation: boolean;
}

export type ModelCapability = 'transcription' | 'translation';

const DEFAULT_MODELS: Record<string, ListedModel[]> = {
  GOOGLE: [
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: true,
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash-Lite',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: true,
    },
  ],
  GROQ: [
    {
      id: 'whisper-large-v3-turbo',
      name: 'Whisper Large V3 Turbo',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: false,
    },
    {
      id: 'whisper-large-v3',
      name: 'Whisper Large V3',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: false,
    },
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      isFree: true,
      supportsTranscription: false,
      supportsTranslation: true,
    },
  ],
  MISTRAL: [
    {
      id: 'voxtral-mini-latest',
      name: 'Voxtral Mini (Transcribe)',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: false,
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      isFree: true,
      supportsTranscription: false,
      supportsTranslation: true,
    },
  ],
  NVIDIA: [
    {
      id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      name: 'Nemotron 3 Nano Omni (audio/transcripción)',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: true,
    },
    {
      id: 'microsoft/phi-4-multimodal-instruct',
      name: 'Phi-4 Multimodal (ASR)',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: true,
    },
    {
      id: 'meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B Instruct',
      isFree: true,
      supportsTranscription: false,
      supportsTranslation: true,
    },
  ],
  OPENROUTER: [
    {
      id: 'openrouter/free',
      name: 'Free Models Router',
      isFree: true,
      supportsTranscription: false,
      supportsTranslation: true,
    },
  ],
  GITHUB: [
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      isFree: true,
      supportsTranscription: true,
      supportsTranslation: true,
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      isFree: true,
      supportsTranscription: false,
      supportsTranslation: true,
    },
  ],
};

function filterByCapability(models: ListedModel[], capability: ModelCapability): ListedModel[] {
  return models.filter((m) =>
    capability === 'transcription' ? m.supportsTranscription : m.supportsTranslation
  );
}

async function listGoogleModels(apiKey: string): Promise<ListedModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`Google ListModels HTTP ${res.status}`);
  const data = await res.json();
  const models: ListedModel[] = (data.models || [])
    .map((m: any) => {
      const id = String(m.name || '').replace(/^models\//, '');
      const lower = id.toLowerCase();
      const methods: string[] = m.supportedGenerationMethods || [];
      if (!methods.includes('generateContent')) return null;
      // Excluir modelos no útiles para texto/audio de la app
      if (/(embedding|imagen|veo|tts|live|robotics|deep-research|computer|lyria|nano-banana)/i.test(lower)) {
        return null;
      }
      const isFlashFamily = /flash/i.test(lower);
      const isPro = /pro/i.test(lower) && !isFlashFamily;
      const isFree = isFlashFamily || /lite|flash-lite/i.test(lower);
      return {
        id,
        name: m.displayName || id,
        isFree: isFree && !isPro,
        supportsTranscription: isFlashFamily || /gemini/i.test(lower),
        supportsTranslation: true,
      } as ListedModel;
    })
    .filter(Boolean);

  return models.filter((m) => m.isFree);
}

async function listOpenAICompatModels(
  apiKey: string,
  baseURL: string,
  classify: (id: string) => Omit<ListedModel, 'id' | 'name'> | null,
  extraHeaders: Record<string, string> = {}
): Promise<ListedModel[]> {
  const res = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`ListModels HTTP ${res.status}`);
  const data = await res.json();
  const items = data.data || data.models || [];
  return items
    .map((m: any) => {
      const id = m.id || m.name;
      if (!id) return null;
      const caps = classify(String(id));
      if (!caps) return null;
      return {
        id: String(id),
        name: m.name || String(id),
        ...caps,
      } as ListedModel;
    })
    .filter(Boolean);
}

async function listOpenRouterFreeModels(apiKey: string): Promise<ListedModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter ListModels HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .map((m: any) => {
      const id = String(m.id || '');
      const prompt = Number(m.pricing?.prompt ?? 1);
      const completion = Number(m.pricing?.completion ?? 1);
      const isFree = id.endsWith(':free') || (prompt === 0 && completion === 0);
      if (!isFree) return null;
      return {
        id,
        name: m.name || id,
        isFree: true,
        supportsTranscription: false,
        supportsTranslation: true,
      } as ListedModel;
    })
    .filter(Boolean);
}

async function listGitHubModels(apiKey: string): Promise<ListedModel[]> {
  const res = await fetch('https://models.github.ai/catalog/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub Models catalog HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.models || data.data || [];
  return items
    .map((m: any) => {
      const id = String(m.id || m.name || '');
      if (!id) return null;
      const modalities: string[] = m.supported_input_modalities || m.input_modalities || [];
      const hasAudio = modalities.some((x) => String(x).toLowerCase().includes('audio'));
      return {
        id,
        name: m.name || id,
        isFree: true,
        supportsTranscription: hasAudio || /gpt-4o|phi-4|llama-4/i.test(id),
        supportsTranslation: true,
      } as ListedModel;
    })
    .filter(Boolean);
}

/**
 * Lista modelos free (o equivalentes de capa gratuita) para un proveedor.
 */
export async function listFreeModels(
  providerType: string,
  apiKey: string,
  capability: ModelCapability = 'transcription'
): Promise<ListedModel[]> {
  const type = providerType.toUpperCase();
  let models: ListedModel[] = [];

  try {
    switch (type) {
      case 'GOOGLE':
        models = await listGoogleModels(apiKey);
        break;
      case 'GROQ':
        models = await listOpenAICompatModels(apiKey, 'https://api.groq.com/openai/v1', (id) => {
          const isWhisper = /whisper/i.test(id);
          return {
            isFree: true,
            supportsTranscription: isWhisper,
            supportsTranslation: !isWhisper,
          };
        });
        break;
      case 'MISTRAL':
        models = await listOpenAICompatModels(apiKey, 'https://api.mistral.ai/v1', (id) => {
          const isVoxtral = /voxtral/i.test(id);
          const isEmbed = /embed|moderat/i.test(id);
          if (isEmbed) return null;
          return {
            isFree: true,
            supportsTranscription: isVoxtral,
            supportsTranslation: !isVoxtral,
          };
        });
        break;
      case 'NVIDIA':
        // En cloud, la transcripción va por modelos multimodales (chat), no por /audio/transcriptions
        models = await listOpenAICompatModels(apiKey, 'https://integrate.api.nvidia.com/v1', (id) => {
          const lower = id.toLowerCase();
          const isOmni = /omni|multimodal|phi-4-multimodal|parakeet|whisper/i.test(lower);
          const isEmbed = /embed|rerank|retrieve/i.test(lower);
          if (isEmbed) return null;
          return {
            isFree: true,
            supportsTranscription: isOmni,
            supportsTranslation: !/whisper|parakeet/i.test(lower) || isOmni,
          };
        });
        break;
      case 'OPENROUTER':
        models = await listOpenRouterFreeModels(apiKey);
        break;
      case 'GITHUB':
        models = await listGitHubModels(apiKey);
        break;
      default:
        models = DEFAULT_MODELS[type] || [];
    }
  } catch (err) {
    console.warn(`listFreeModels(${type}) falló, usando defaults:`, err);
    models = DEFAULT_MODELS[type] || [];
  }

  if (models.length === 0) {
    models = DEFAULT_MODELS[type] || [];
  }

  const filtered = filterByCapability(models, capability);
  // Si el filtro deja vacío (p.ej. catálogo sin whitelists), usar defaults de esa capacidad
  if (filtered.length === 0) {
    return filterByCapability(DEFAULT_MODELS[type] || [], capability);
  }
  return filtered;
}

export function getDefaultModelId(providerType: string, capability: ModelCapability = 'transcription'): string {
  const defaults = filterByCapability(DEFAULT_MODELS[providerType.toUpperCase()] || [], capability);
  return defaults[0]?.id || '';
}
