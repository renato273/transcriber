import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, Save, RefreshCw } from 'lucide-react';
import { toast } from './alerts';
import AdminSubnav from './AdminSubnav.jsx';

const PROVIDER_DEFS = [
  {
    type: 'GOOGLE',
    name: 'Google Gemini',
    supportsTranscription: true,
    placeholder: 'AIzaSy...',
  },
  {
    type: 'NVIDIA',
    name: 'NVIDIA NIM (Whisper)',
    supportsTranscription: true,
    placeholder: 'nvapi-...',
  },
  {
    type: 'OPENROUTER',
    name: 'OpenRouter (solo traducción)',
    supportsTranscription: false,
    placeholder: 'sk-or-...',
  },
  {
    type: 'MISTRAL',
    name: 'Mistral AI (Voxtral)',
    supportsTranscription: true,
    placeholder: 'API key de console.mistral.ai',
  },
  {
    type: 'GROQ',
    name: 'Groq (Whisper)',
    supportsTranscription: true,
    placeholder: 'gsk_...',
  },
  {
    type: 'GITHUB',
    name: 'GitHub Models',
    supportsTranscription: true,
    placeholder: 'ghp_... (PAT con models:read)',
  },
];

export default function AdminContent() {
  const [providers, setProviders] = useState([]);
  const [settings, setSettings] = useState({
    audio_retention_days: '7',
    allow_registration: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
    
  const [apiKeys, setApiKeys] = useState(
    Object.fromEntries(PROVIDER_DEFS.map((p) => [p.type, '']))
  );
  const [baseUrls, setBaseUrls] = useState(
    Object.fromEntries(PROVIDER_DEFS.map((p) => [p.type, '']))
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const provRes = await fetch('/api/admin/providers');
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviders(provData);

        const keysMap = {};
        const urlsMap = {};
        provData.forEach((p) => {
          keysMap[p.type] = p.apiKey || '';
          urlsMap[p.type] = p.baseUrl || '';
        });
        setApiKeys((prev) => ({ ...prev, ...keysMap }));
        setBaseUrls((prev) => ({ ...prev, ...urlsMap }));
      } else {
        toast.error('Error al cargar proveedores de IA.');
      }

      const setRes = await fetch('/api/admin/settings');
      if (setRes.ok) {
        const setData = await setRes.json();
        setSettings((prev) => ({ ...prev, ...setData }));
      }
    } catch (e) {
      toast.error('Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyChange = (providerType, value) => {
    setApiKeys((prev) => ({ ...prev, [providerType]: value }));
  };

  const saveProvider = async (type) => {
    setSavingProvider(type);

    const def = PROVIDER_DEFS.find((p) => p.type === type);
    const providerObj = providers.find((p) => p.type === type) || {
      type,
      name: def?.name || type,
      isActive: false,
      isDefaultTranscription: false,
      isDefaultTranslation: false,
    };

    const payload = {
      type,
      name: providerObj.name || def?.name || type,
      apiKey: apiKeys[type],
      baseUrl: baseUrls[type] || null,
      isActive: providerObj.isActive,
      isDefaultTranscription: providerObj.isDefaultTranscription,
      isDefaultTranslation: providerObj.isDefaultTranslation,
    };

    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Proveedor ${type} actualizado con éxito.`);
        await fetchData();
      } else {
        toast.error(data.error || 'Error al guardar proveedor');
      }
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setSavingProvider(null);
    }
  };

  const toggleProviderBoolean = (type, field) => {
    setProviders((prev) => {
      const existing = prev.find((p) => p.type === type);
      const def = PROVIDER_DEFS.find((p) => p.type === type);

      if (!existing) {
        const created = {
          type,
          name: def?.name || type,
          isActive: field === 'isActive',
          isDefaultTranscription: field === 'isDefaultTranscription',
          isDefaultTranslation: field === 'isDefaultTranslation',
        };
        return [
          ...prev.map((p) =>
            field.startsWith('isDefault') ? { ...p, [field]: false } : p
          ),
          created,
        ];
      }

      return prev.map((p) => {
        if (p.type === type) {
          return { ...p, [field]: !p[field] };
        }
        if (field.startsWith('isDefault') && p[field]) {
          return { ...p, [field]: false };
        }
        return p;
      });
    });
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value,
    }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const payloads = [
        { key: 'audio_retention_days', value: settings.audio_retention_days },
        { key: 'allow_registration', value: settings.allow_registration === 'true' ? 'true' : 'false' },
      ];

      const results = await Promise.all(
        payloads.map((body) =>
          fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        )
      );

      if (results.every((r) => r.ok)) {
        toast.success('Configuraciones generales guardadas con éxito.');
      } else {
        toast.error('Error al guardar configuraciones.');
      }
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div class="flex-grow flex items-center justify-center p-8 bg-[#0B0F19]">
        <div class="text-center text-gray-400 space-y-3">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div class="text-sm">Cargando Panel de Administración...</div>
        </div>
      </div>
    );
  }

  return (
    <div class="max-w-4xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100vh-4rem)] flex flex-col justify-start">

      <div class="flex flex-col gap-4 border-b border-[#1F293D] pb-4 sm:pb-5">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            <Shield class="w-7 h-7 sm:w-8 sm:h-8 text-accent shrink-0" />
            <span class="leading-tight">API Keys / Proveedores</span>
          </h1>
          <p class="text-sm text-gray-400 mt-1.5 sm:mt-1">Configura credenciales de IA y parámetros de limpieza de almacenamiento local.</p>
        </div>
        <AdminSubnav active="providers" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">

        <div class="md:col-span-2 space-y-4 sm:space-y-6">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Key class="w-5 h-5 text-gray-400 shrink-0" /> Proveedores de IA
          </h2>

          {PROVIDER_DEFS.map((def) => {
            const provider = providers.find((p) => p.type === def.type) || {
              type: def.type,
              name: def.name,
              isActive: false,
              isDefaultTranscription: false,
              isDefaultTranslation: false,
            };

            return (
              <div key={def.type} class="p-4 sm:p-6 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-4 sm:space-y-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#1F293D] pb-3">
                  <div class="min-w-0">
                    <h3 class="text-md font-bold text-white break-words">{def.name}</h3>
                    <span class="text-[10px] text-gray-500 font-mono">{def.type}</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={!!provider.isActive}
                      onChange={() => toggleProviderBoolean(def.type, 'isActive')}
                      class="sr-only peer"
                    />
                    <div class="w-9 h-5 bg-[#0E1524] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
                    <span class="ml-2 text-xs font-semibold text-gray-400 peer-checked:text-white">Activo</span>
                  </label>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={apiKeys[def.type] || ''}
                      onChange={(e) => handleKeyChange(def.type, e.target.value)}
                      placeholder={def.placeholder}
                      class="w-full px-3 py-2.5 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
                    />
                  </div>

                  {def.type === 'NVIDIA' && (
                    <div>
                      <label class="block text-xs font-medium text-gray-400 mb-1.5">
                        Base URL NIM (opcional, autohospedado)
                      </label>
                      <input
                        type="url"
                        value={baseUrls[def.type] || ''}
                        onChange={(e) =>
                          setBaseUrls((prev) => ({ ...prev, [def.type]: e.target.value }))
                        }
                        placeholder="http://localhost:9000/v1"
                        class="w-full px-3 py-2.5 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
                      />
                      <p class="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                        Vacío = API cloud oficial (integrate.api.nvidia.com/chat con modelos multimodales). Solo usa Base URL si tienes un contenedor NIM ASR local (ej. http://localhost:9000/v1).
                      </p>
                    </div>
                  )}

                  <div class="flex flex-wrap gap-4 pt-2">
                    {def.supportsTranscription && (
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!provider.isDefaultTranscription}
                          onChange={() => toggleProviderBoolean(def.type, 'isDefaultTranscription')}
                          class="rounded bg-[#0E1524] border-[#1F293D] text-primary focus:ring-0 focus:ring-offset-0"
                        />
                        <span class="text-xs text-gray-300">Default para Transcripción</span>
                      </label>
                    )}

                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!provider.isDefaultTranslation}
                        onChange={() => toggleProviderBoolean(def.type, 'isDefaultTranslation')}
                        class="rounded bg-[#0E1524] border-[#1F293D] text-primary focus:ring-0 focus:ring-offset-0"
                      />
                      <span class="text-xs text-gray-300">Default para Traducción</span>
                    </label>
                  </div>
                </div>

                <div class="flex justify-stretch sm:justify-end pt-2">
                  <button
                    onClick={() => saveProvider(def.type)}
                    disabled={savingProvider === def.type}
                    class="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {savingProvider === def.type ? (
                      <>
                        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save class="w-3.5 h-3.5" />
                        <span>Guardar Proveedor</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div class="space-y-4 sm:space-y-6">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Settings class="w-5 h-5 text-gray-400 shrink-0" /> Ajustes del Sistema
          </h2>

          <form onSubmit={saveSettings} class="p-4 sm:p-6 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-5">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">
                Retención de Audios (Días)
              </label>
              <input
                type="number"
                name="audio_retention_days"
                value={settings.audio_retention_days}
                onChange={handleSettingsChange}
                min="1"
                max="90"
                class="w-full px-3 py-2.5 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
              />
              <p class="text-[10px] text-gray-500 mt-2 leading-relaxed">
                Los archivos de audio subidos o grabados se eliminarán físicamente del disco del servidor después de estos días para conservar almacenamiento. Los registros de texto son permanentes.
              </p>
            </div>

            <div class="pt-2 border-t border-[#1F293D]">
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="allow_registration"
                  checked={settings.allow_registration === 'true'}
                  onChange={handleSettingsChange}
                  class="mt-1 rounded bg-[#0E1524] border-[#1F293D] text-primary focus:ring-0 focus:ring-offset-0"
                />
                <span>
                  <span class="block text-sm font-semibold text-white">Permitir registro de nuevos usuarios</span>
                  <span class="block text-[10px] text-gray-500 mt-1 leading-relaxed">
                    Tras crear el primer ADMIN, el registro se cierra solo. Activá esta opción para permitir altas públicas de USER otra vez. Los admins existentes no se ven afectados.
                  </span>
                </span>
              </label>
              <p
                class={`mt-3 text-xs font-medium px-2.5 py-1.5 rounded-lg border inline-block ${
                  settings.allow_registration === 'true'
                    ? 'bg-green-500/10 border-green-500/25 text-green-400'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                }`}
              >
                Estado: {settings.allow_registration === 'true' ? 'Registro abierto' : 'Registro cerrado'}
              </p>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              class="w-full min-h-[44px] py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save class="w-3.5 h-3.5" />
                  <span>Guardar Parámetros</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
