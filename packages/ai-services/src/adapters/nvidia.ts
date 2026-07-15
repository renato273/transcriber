import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { AIServiceInterface } from '../index.js';
import { getDefaultModelId } from '../listModels.js';

/**
 * Transcripción cloud según docs.api.nvidia.com:
 * - Base: https://integrate.api.nvidia.com/v1
 * - Endpoint: /chat/completions (modelos multimodales con audio)
 * - Audio: audio_url (data URL) o NVCF Asset si > ~180KB
 *   https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning-infer
 *
 * El path /v1/audio/transcriptions NO existe en integrate.api (solo NIM autohospedado).
 */
const NVIDIA_CHAT_BASE = 'https://integrate.api.nvidia.com/v1';
const NVCF_ASSETS_URL = 'https://api.nvcf.nvidia.com/v2/nvcf/assets';
const INLINE_AUDIO_LIMIT = 180 * 1024; // docs: >180KB requiere asset upload

const DEFAULT_TRANSCRIBE_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

export class NvidiaAdapter implements AIServiceInterface {
  private apiKey: string;
  private openai: OpenAI;
  /** Si se define, usa API HTTP estilo Whisper de un NIM local (…/v1/audio/transcriptions). */
  private asrBaseUrl: string | null;

  constructor(apiKey: string, baseUrl?: string | null) {
    this.apiKey = apiKey;
    this.asrBaseUrl = baseUrl?.replace(/\/$/, '') || null;
    this.openai = new OpenAI({
      apiKey,
      baseURL: NVIDIA_CHAT_BASE,
    });
  }

  async transcribeAudio(
    filePath: string,
    mimeType: string = 'audio/webm',
    modelId?: string
  ): Promise<string> {
    try {
      if (this.asrBaseUrl) {
        return await this.transcribeSelfHosted(filePath, mimeType, modelId);
      }
      return await this.transcribeCloudMultimodal(filePath, mimeType, modelId);
    } catch (error: any) {
      console.error('Error en Nvidia NIM Transcription:', error);
      throw new Error(`Nvidia NIM Falló: ${error.message}`);
    }
  }

  /**
   * Cloud: chat/completions + audio_url (documentación oficial NVIDIA API).
   */
  private async transcribeCloudMultimodal(
    filePath: string,
    mimeType: string,
    modelId?: string
  ): Promise<string> {
    const model = modelId || DEFAULT_TRANSCRIBE_MODEL || getDefaultModelId('NVIDIA', 'transcription');
    const buffer = fs.readFileSync(filePath);
    const audioMime = this.normalizeAudioMime(mimeType, filePath);

    let assetHeader: string | undefined;
    let audioUrl: string;

    if (buffer.length > INLINE_AUDIO_LIMIT) {
      const assetId = await this.uploadNvcfAsset(buffer, audioMime);
      assetHeader = assetId;
      audioUrl = `data:${audioMime};asset_id,${assetId}`;
    } else {
      audioUrl = `data:${audioMime};base64,${buffer.toString('base64')}`;
    }

    const headers: Record<string, string> = {};
    if (assetHeader) {
      headers['NVCF-INPUT-ASSET-REFERENCES'] = assetHeader;
    }

    const completion = await this.openai.chat.completions.create(
      {
        model,
        messages: [
          {
            role: 'system',
            content: '/no_think',
          },
          {
            role: 'user',
            content: [
              {
                type: 'audio_url',
                audio_url: { url: audioUrl },
              } as any,
              {
                type: 'text',
                text: 'Transcribe the spoken content literally and exactly. Return only the transcript text, without commentary.',
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.2,
        // @ts-expect-error NVIDIA extra body
        chat_template_kwargs: { enable_thinking: false },
      },
      assetHeader ? { headers } : undefined
    );

    const text = completion.choices[0]?.message?.content?.trim() || '';
    if (!text) {
      throw new Error('El modelo multimodal no devolvió texto de transcripción.');
    }
    return text;
  }

  /** NIM autohospedado con REST /v1/audio/transcriptions */
  private async transcribeSelfHosted(
    filePath: string,
    mimeType: string,
    modelId?: string
  ): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath) || 'audio.webm';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
    form.append('language', 'multi');
    if (modelId) form.append('model', modelId);

    const res = await fetch(`${this.asrBaseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      body: form,
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
    }

    try {
      const data = JSON.parse(raw);
      return String(data.text || data.transcription || '').trim();
    } catch {
      return raw.trim();
    }
  }

  /**
   * Sube audio grande al bucket NVCF (Create Asset + PUT presigned).
   * https://docs.api.nvidia.com/cloud-functions/reference/createasset
   */
  private async uploadNvcfAsset(buffer: Buffer, contentType: string): Promise<string> {
    const createRes = await fetch(NVCF_ASSETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        contentType,
        description: 'transcription-audio',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`NVCF Create Asset falló (${createRes.status}): ${err.slice(0, 200)}`);
    }

    const { assetId, uploadUrl } = await createRes.json();
    if (!assetId || !uploadUrl) {
      throw new Error('NVCF Create Asset no devolvió assetId/uploadUrl');
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-meta-nvcf-asset-description': 'transcription-audio',
      },
      body: new Uint8Array(buffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`NVCF Asset upload falló (${uploadRes.status}): ${err.slice(0, 200)}`);
    }

    return assetId;
  }

  private normalizeAudioMime(mimeType: string, filePath: string): string {
    const lower = (mimeType || '').toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    // Docs NVIDIA cloud: WAV o MP3 para audio en chat/completions
    if (lower.includes('mpeg') || lower.includes('mp3') || ext === '.mp3') return 'audio/mpeg';
    if (lower.includes('wav') || ext === '.wav') return 'audio/wav';
    if (lower.includes('flac') || ext === '.flac') return 'audio/flac';
    // webm/ogg: se envían igual; el modelo puede rechazarlos — preferible subir mp3/wav
    if (lower.includes('webm') || ext === '.webm') return 'audio/webm';
    if (lower.includes('ogg') || ext === '.ogg') return 'audio/ogg';
    return mimeType || 'audio/wav';
  }

  async translateText(text: string, targetLang: string, modelId?: string): Promise<string> {
    const model = modelId || getDefaultModelId('NVIDIA', 'translation');
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: `Traduce al idioma "${targetLang}". Retorna única y exclusivamente la traducción:\n\n${text}`,
          },
        ],
        temperature: 0.1,
      });

      return completion.choices[0].message.content?.trim() || '';
    } catch (error: any) {
      console.error('Error en Nvidia NIM Translation:', error);
      throw error;
    }
  }
}
