import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, Save, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function AdminContent() {
  const [providers, setProviders] = useState([]);
  const [settings, setSettings] = useState({
    audio_retention_days: '7'
  });
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null); // type
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form values for providers keys
  const [apiKeys, setApiKeys] = useState({
    GOOGLE: '',
    NVIDIA: '',
    OPENROUTER: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch AI Providers
      const provRes = await fetch('/api/admin/providers');
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviders(provData);
        
        // Initialize keys object with '********' if key is set in DB
        const keysMap = {};
        provData.forEach(p => {
          keysMap[p.type] = p.apiKey || '';
        });
        setApiKeys(prev => ({ ...prev, ...keysMap }));
      } else {
        setErrorMsg('Error al cargar proveedores de IA.');
      }

      // 2. Fetch General Settings
      const setRes = await fetch('/api/admin/settings');
      if (setRes.ok) {
        const setData = await setRes.json();
        setSettings(prev => ({ ...prev, ...setData }));
      }
    } catch (e) {
      setErrorMsg('Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyChange = (providerType, value) => {
    setApiKeys(prev => ({ ...prev, [providerType]: value }));
  };

  const saveProvider = async (type) => {
    setSavingProvider(type);
    setErrorMsg('');
    setSuccessMsg('');

    const providerObj = providers.find(p => p.type === type) || {
      type,
      name: type === 'GOOGLE' ? 'Google Gemini Free' : type === 'NVIDIA' ? 'Nvidia Whisper NIM' : 'OpenRouter Free LLM',
      isActive: false,
      isDefaultTranscription: false,
      isDefaultTranslation: false
    };

    const payload = {
      type,
      name: providerObj.name,
      apiKey: apiKeys[type],
      isActive: providerObj.isActive,
      isDefaultTranscription: providerObj.isDefaultTranscription,
      isDefaultTranslation: providerObj.isDefaultTranslation
    };

    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Proveedor ${type} actualizado con éxito.`);
        await fetchData(); // Reload to refresh defaults and key status
      } else {
        setErrorMsg(data.error || 'Error al guardar proveedor');
      }
    } catch (e) {
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setSavingProvider(null);
    }
  };

  const toggleProviderBoolean = (type, field) => {
    setProviders(prev => prev.map(p => {
      if (p.type === type) {
        return { ...p, [field]: !p[field] };
      }
      // If we are setting default transcription/translation to true, set others to false
      if (field.startsWith('isDefault') && !p[field] && p.type !== type) {
        return { ...p, [field]: false };
      }
      return p;
    }));
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'audio_retention_days',
          value: settings.audio_retention_days
        })
      });

      if (res.ok) {
        setSuccessMsg('Configuraciones generales guardadas con éxito.');
      } else {
        setErrorMsg('Error al guardar configuraciones.');
      }
    } catch (e) {
      setErrorMsg('Error al conectar con el servidor.');
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
    <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 min-h-[calc(100vh-4rem)] flex flex-col justify-start">
      
      {/* Page Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#1F293D] pb-5 gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white flex items-center gap-2">
            <Shield class="w-8 h-8 text-accent" /> Panel de Administración
          </h1>
          <p class="text-sm text-gray-400 mt-1">Configura credenciales de IA y parámetros de limpieza de almacenamiento local.</p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div class="p-4 rounded-2xl bg-green-950/30 border border-green-900/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle class="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div class="p-4 rounded-2xl bg-red-950/30 border border-red-900/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* COL 1 & 2: PROVIDERS LIST */}
        <div class="md:col-span-2 space-y-6">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <Key class="w-5 h-5 text-gray-400" /> Proveedores de IA Gratuitos
          </h2>

          {['GOOGLE', 'NVIDIA', 'OPENROUTER'].map((type) => {
            const provider = providers.find(p => p.type === type) || {
              type,
              name: type === 'GOOGLE' ? 'Google Gemini Free' : type === 'NVIDIA' ? 'Nvidia Whisper NIM' : 'OpenRouter Free LLM',
              isActive: false,
              isDefaultTranscription: false,
              isDefaultTranslation: false
            };

            const isGemini = type === 'GOOGLE';
            const isNvidia = type === 'NVIDIA';

            return (
              <div key={type} class="p-6 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-5">
                <div class="flex items-center justify-between border-b border-[#1F293D] pb-3">
                  <div>
                    <h3 class="text-md font-bold text-white">{provider.name}</h3>
                    <span class="text-[10px] text-gray-500 font-mono">{type}</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provider.isActive}
                      onChange={() => toggleProviderBoolean(type, 'isActive')}
                      class="sr-only peer"
                    />
                    <div class="w-9 h-5 bg-[#0E1524] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
                    <span class="ml-2 text-xs font-semibold text-gray-400 peer-checked:text-white">Activo</span>
                  </label>
                </div>

                <div class="space-y-4">
                  {/* API Key Input */}
                  <div>
                    <label class="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={apiKeys[type]}
                      onChange={(e) => handleKeyChange(type, e.target.value)}
                      placeholder="AIzaSy... o similar"
                      class="w-full px-3 py-2.5 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
                    />
                  </div>

                  {/* Defaults toggles */}
                  <div class="flex flex-wrap gap-4 pt-2">
                    {/* Only show transcription default for Gemini/Nvidia NIM */}
                    {(isGemini || isNvidia) && (
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={provider.isDefaultTranscription}
                          onChange={() => toggleProviderBoolean(type, 'isDefaultTranscription')}
                          class="rounded bg-[#0E1524] border-[#1F293D] text-primary focus:ring-0 focus:ring-offset-0"
                        />
                        <span class="text-xs text-gray-300">Default para Transcripción</span>
                      </label>
                    )}

                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={provider.isDefaultTranslation}
                        onChange={() => toggleProviderBoolean(type, 'isDefaultTranslation')}
                        class="rounded bg-[#0E1524] border-[#1F293D] text-primary focus:ring-0 focus:ring-offset-0"
                      />
                      <span class="text-xs text-gray-300">Default para Traducción</span>
                    </label>
                  </div>
                </div>

                <div class="flex justify-end pt-2">
                  <button
                    onClick={() => saveProvider(type)}
                    disabled={savingProvider === type}
                    class="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {savingProvider === type ? (
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

        {/* COL 3: GENERAL SETTINGS */}
        <div class="space-y-6">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <Settings class="w-5 h-5 text-gray-400" /> Ajustes del Sistema
          </h2>

          <form onSubmit={saveSettings} class="p-6 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-5">
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
                class="w-full px-3 py-2 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
              />
              <p class="text-[10px] text-gray-500 mt-2 leading-relaxed">
                Los archivos de audio subidos o grabados se eliminarán físicamente del disco del servidor después de estos días para conservar almacenamiento. Los registros de texto son permanentes.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              class="w-full py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
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
