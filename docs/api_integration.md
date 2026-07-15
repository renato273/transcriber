# API e Integración de Proveedores de IA

Este documento describe la especificación de los endpoints de la API de Astro y detalla la implementación técnica para integrar los proveedores de IA gratuitos: **Google Gemini**, **NVIDIA NIM** y **OpenRouter**.

---

## 1. Especificación de Endpoints (Astro API)

Los endpoints de Astro se implementan en la carpeta `apps/web/src/pages/api/` y se ejecutan en el servidor (SSR).

### Autenticación (`/api/auth/`)
* **`POST /api/auth/register`**: Registra un nuevo usuario.
  * *Request Body*: `{ "email": "user@example.com", "password": "securepassword" }`
  * *Response*: `{ "success": true, "user": { "id": "uuid", "email": "user@example.com" } }`
* **`POST /api/auth/login`**: Valida credenciales y establece una cookie HTTP-only con el token JWT o el session ID.
  * *Request Body*: `{ "email": "user@example.com", "password": "securepassword" }`
  * *Response*: `{ "success": true }` (Configura la cookie `session_id`).
* **`POST /api/auth/logout`**: Invalida la sesión actual en la base de datos y borra la cookie.
  * *Response*: `{ "success": true }`

### Sesiones de Transcripción (`/api/sessions/`)
* **`GET /api/sessions`**: Devuelve las sesiones del usuario autenticado.
  * *Response*: `[ { "id": "uuid", "title": "Clases", "createdAt": "2026-07-15..." } ]`
* **`POST /api/sessions`**: Crea una nueva sesión.
  * *Request Body*: `{ "title": "Nueva Reunión" }`

### Procesamiento de Audio (`/api/transcribe` & `/api/translate`)
* **`POST /api/transcribe`**: Recibe audio, lo guarda localmente y dispara la transcripción por IA.
  * *Headers*: `Content-Type: multipart/form-data`
  * *Form Data*: 
    * `audio`: Archivo binario (mp3, wav, webm).
    * `sessionId`: ID de la sesión de transcripción.
    * `language`: Idioma sugerido (opcional).
  * *Response*: `{ "success": true, "transcription": { "id": "uuid", "originalText": "Hola mundo..." } }`
* **`POST /api/translate`**: Traduce una transcripción existente.
  * *Request Body*: `{ "transcriptionId": "uuid", "targetLanguage": "en" }`
  * *Response*: `{ "success": true, "translatedText": "Hello world..." }`

### Administración (Solo ADMIN) (`/api/admin/`)
* **`POST /api/admin/providers`**: Guarda y actualiza las credenciales de un proveedor de IA.
  * *Request Body*: `{ "type": "GOOGLE", "apiKey": "AIzaSy...", "isActive": true }`
* **`POST /api/admin/settings`**: Configura variables del sistema.
  * *Request Body*: `{ "key": "audio_retention_days", "value": "10" }`

---

## 2. Integración de Proveedores de IA Gratuitos

Para mantener los costos a cero, el backend soporta los siguientes adaptadores de IA que consumen API keys de capas gratuitas.

### A. Google Gemini API (Transcriptor y Traductor Gratuito)
Google AI Studio ofrece **Gemini 1.5 Flash** con un límite gratuito de 15 peticiones por minuto (RPM) y 1.5 millones de tokens de contexto. Admite archivos de audio directamente en su API de chat y generación de contenido.

#### Código de Integración (`packages/ai-services/src/adapters/gemini.js`)
```javascript
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

export class GeminiAdapter {
  constructor(apiKey) {
    // Inicializa el cliente oficial de Google GenAI
    this.ai = new GoogleGenAI({ apiKey });
  }

  async transcribeAudio(filePath, mimeType = 'audio/webm') {
    try {
      // 1. Leer el archivo local
      const audioBuffer = fs.readFileSync(filePath);
      const base64Audio = audioBuffer.toString('base64');

      // 2. Llamar a Gemini enviando el audio en línea
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio
                }
              },
              {
                text: "Transcribe el audio adjunto de manera literal y exacta. Devuelve únicamente la transcripción del texto sin comentarios adicionales."
              }
            ]
          }
        ]
      });

      return response.text.trim();
    } catch (error) {
      console.error("Error en Gemini Transcription:", error);
      throw new Error(`Gemini Falló: ${error.message}`);
    }
  }

  async translateText(text, targetLang) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Traduce el siguiente texto al idioma especificado por el código de idioma ISO: "${targetLang}". 
Devuelve única y exclusivamente el texto traducido final, sin explicaciones ni notas de traducción:

Texto a traducir:
${text}`
      });

      return response.text.trim();
    } catch (error) {
      console.error("Error en Gemini Translation:", error);
      throw error;
    }
  }
}
```

---

### B. NVIDIA NIM API (Whisper-large-v3 Gratuito)
El programa de desarrolladores de NVIDIA ofrece créditos gratuitos para usar sus microservicios (NIM). Uno de los modelos más potentes para transcripción es **Whisper-large-v3**, disponible mediante una API compatible con OpenAI.

#### Código de Integración (`packages/ai-services/src/adapters/nvidia.js`)
```javascript
import OpenAI from 'openai';
import fs from 'fs';

export class NvidiaAdapter {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
  }

  async transcribeAudio(filePath) {
    try {
      // Crear un File object compatible de Node.js a partir del stream
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'nvidia/whisper-large-v3',
        response_format: 'verbose_json',
      });

      return response.text;
    } catch (error) {
      console.error("Error en Nvidia Whisper NIM:", error);
      throw new Error(`Nvidia NIM Falló: ${error.message}`);
    }
  }

  async translateText(text, targetLang) {
    // Si bien Nvidia se enfoca en Whisper para audio, se puede usar Llama-3 en NIM para traducción
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'meta/llama3-8b-instruct',
        messages: [
          {
            role: 'user',
            content: `Traduce al idioma "${targetLang}". Retorna solo la traducción:\n\n${text}`
          }
        ],
        temperature: 0.1,
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error en Nvidia NIM Translation:", error);
      throw error;
    }
  }
}
```

---

### C. OpenRouter API (Modelos LLM Gratuitos para Traducción y Formateo)
OpenRouter provee una API unificada compatible con OpenAI. Ofrecen múltiples modelos totalmente gratis (como `meta-llama/llama-3-8b-instruct:free`, `google/gemma-2-9b-it:free`, etc.) ideales para tareas de traducción.

#### Código de Integración (`packages/ai-services/src/adapters/openrouter.js`)
```javascript
import OpenAI from 'openai';

export class OpenRouterAdapter {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/tu-usuario/transcriber', // Requerido por OpenRouter
        'X-Title': 'AI Audio Transcriber', // Requerido por OpenRouter
      }
    });
  }

  async transcribeAudio(filePath) {
    // Nota: OpenRouter no ofrece endpoints nativos de transcripción de audio gratuitos de manera confiable.
    // Se recomienda usar este adaptador principalmente para traducciones o post-procesamiento.
    throw new Error("Transcripción de audio no soportada en el adaptador gratuito de OpenRouter.");
  }

  async translateText(text, targetLang) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'meta-llama/llama-3-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'Eres un traductor profesional. Traduce el texto al idioma solicitado. Devuelve estrictamente solo la traducción, sin textos introductorios ni explicaciones.'
          },
          {
            role: 'user',
            content: `Idioma destino: ${targetLang}\n\nTexto:\n${text}`
          }
        ],
        temperature: 0.2
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error en OpenRouter Translation:", error);
      throw error;
    }
  }
}
```

---

## 3. Patrón Factory para Selección de Proveedores

Para abstraer qué API está utilizando el sistema en cada momento (según la configuración activa en el panel de administrador), se utiliza un Factory Pattern que expone una interfaz común.

#### `packages/ai-services/src/factory.js`
```javascript
import { GeminiAdapter } from './adapters/gemini.js';
import { NvidiaAdapter } from './adapters/nvidia.js';
import { OpenRouterAdapter } from './adapters/openrouter.js';

export class AIServiceFactory {
  /**
   * Crea un adaptador de IA basado en los datos almacenados de la base de datos
   * @param {string} type - 'GOOGLE', 'NVIDIA', 'OPENROUTER'
   * @param {string} decryptedApiKey - La API Key desencriptada
   * @param {string} [baseUrl] - URL base para endpoints customizados
   */
  static createAdapter(type, decryptedApiKey, baseUrl) {
    switch (type) {
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
```
