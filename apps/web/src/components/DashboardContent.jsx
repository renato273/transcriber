import React, { useState, useEffect, useRef } from 'react';
import { Mic, Upload, Trash2, Plus, Volume2, Globe, AlertCircle, Loader, Cpu, RefreshCw } from 'lucide-react';
import { toast, confirmDialog } from './alerts';

export default function DashboardContent() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [transcriptions, setTranscriptions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const timerRef = useRef(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);

  const [translatingId, setTranslatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [targetLanguages, setTargetLanguages] = useState({});

  const [actionLoading, setActionLoading] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(true);

  useEffect(() => {
    fetchSessions();
    fetchProviders();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchSessionDetails(activeSession.id);
    } else {
      setTranscriptions([]);
    }
  }, [activeSession]);

  useEffect(() => {
    if (selectedProvider) {
      fetchModels(selectedProvider);
    } else {
      setModels([]);
      setSelectedModel('');
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers?capability=transcription');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
        const defaultProv = data.find((p) => p.isDefaultTranscription) || data[0];
        if (defaultProv) {
          setSelectedProvider(defaultProv.type);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchModels = async (providerType) => {
    setLoadingModels(true);
    setModels([]);
    setSelectedModel('');
    try {
      const res = await fetch(
        `/api/providers/models?type=${encodeURIComponent(providerType)}&capability=transcription`
      );
      const data = await res.json();
      if (res.ok) {
        const list = data.models || [];
        setModels(list);
        if (list.length > 0) {
          setSelectedModel(list[0].id);
        }
      } else {
        toast.error(data.error || 'No se pudieron cargar los modelos free');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al listar modelos del proveedor');
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchSessionDetails = async (id) => {
    setLoadingTranscriptions(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTranscriptions(data.transcriptions || []);
      }
    } catch (e) {
      toast.error('Error al cargar grabaciones');
    } finally {
      setLoadingTranscriptions(false);
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSessionTitle })
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions([newSession, ...sessions]);
        setActiveSession(newSession);
        setNewSessionTitle('');
        toast.success('Sesión creada');
      } else {
        toast.error('No se pudo crear la sesión');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al conectar con el servidor');
    }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Eliminar sesión',
      message: 'Se eliminarán todas las grabaciones y traducciones de esta sesión. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = sessions.filter(s => s.id !== id);
        setSessions(remaining);
        if (activeSession?.id === id) {
          setActiveSession(remaining.length > 0 ? remaining[0] : null);
        }
        toast.success('Sesión eliminada');
      } else {
        toast.error('No se pudo eliminar la sesión');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al conectar con el servidor');
    }
  };

  const deleteTranscription = async (id) => {
    const ok = await confirmDialog({
      title: 'Eliminar transcripción',
      message: 'Se eliminará el texto, las traducciones y el archivo de audio asociados.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setTranscriptions((prev) => prev.filter((t) => t.id !== id));
        toast.success('Transcripción eliminada');
      } else {
        toast.error(data.error || 'No se pudo eliminar la transcripción');
      }
    } catch (e) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setDeletingId(null);
    }
  };

  const startRecording = async () => {
    if (!selectedProvider) {
      toast.error('Selecciona un proveedor de IA antes de grabar.');
      return;
    }
    if (!selectedModel) {
      toast.error('Selecciona un modelo free antes de grabar.');
      return;
    }
    setRecordingTime(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleAudioUpload(blob, 'grabacion.webm');
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      toast.error('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && isRecording) {
      if (isPaused) {
        mediaRecorder.resume();
        setIsPaused(false);
      } else {
        mediaRecorder.pause();
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        setUploadFile(file);
      } else {
        toast.error('Por favor, arrastra solo archivos de audio');
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      setUploadFile(files[0]);
    }
  };

  const submitFile = async () => {
    if (!uploadFile) return;
    if (!selectedProvider || !selectedModel) {
      toast.error('Selecciona proveedor y modelo free antes de transcribir.');
      return;
    }
    setActionLoading(true);
    try {
      await handleAudioUpload(uploadFile, uploadFile.name);
      setUploadFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAudioUpload = async (audioBlob, fileName) => {
    if (!activeSession) return;
    setActionLoading(true);

    const formData = new FormData();
    formData.append('audio', audioBlob, fileName);
    formData.append('sessionId', activeSession.id);
    formData.append('language', 'es');
    if (selectedProvider) formData.append('providerType', selectedProvider);
    if (selectedModel) formData.append('modelId', selectedModel);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        await fetchSessionDetails(activeSession.id);
        toast.success('Transcripción completada');
      } else {
        toast.error(data.error || data.details || 'Error al procesar la transcripción');
      }
    } catch (err) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTranslate = async (transcriptionId) => {
    const lang = targetLanguages[transcriptionId] || 'en';
    setTranslatingId(transcriptionId);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptionId, targetLanguage: lang })
      });

      const data = await res.json();
      if (res.ok) {
        await fetchSessionDetails(activeSession.id);
        toast.success('Traducción lista');
      } else {
        toast.error(data.error || 'Error al traducir');
      }
    } catch (err) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setTranslatingId(null);
    }
  };

  const handleLangChange = (id, lang) => {
    setTargetLanguages(prev => ({ ...prev, [id]: lang }));
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const providerLabel = (type) => {
    const found = providers.find((p) => p.type === type);
    return found?.label || type;
  };

  const canTranscribe = !!selectedProvider && !!selectedModel && !loadingModels;

  return (
    <div class="flex-grow flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 gap-4 sm:gap-6 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">

      {/* Sessions: collapsible on mobile, sidebar on desktop */}
      <div class="w-full lg:w-72 xl:w-80 flex flex-col bg-[#151D30]/40 border border-[#1F293D] rounded-2xl sm:rounded-3xl p-3 sm:p-5 shrink-0">
        <button
          type="button"
          onClick={() => setSessionsOpen((v) => !v)}
          class="lg:pointer-events-none flex items-center justify-between w-full text-left"
        >
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            Mis Sesiones
            <span class="text-[10px] font-normal text-gray-500 lg:hidden">
              ({sessions.length})
            </span>
          </h2>
          <span class={`lg:hidden text-gray-400 transition-transform ${sessionsOpen ? 'rotate-180' : ''}`}>
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        <div class={`${sessionsOpen ? 'block' : 'hidden'} lg:block mt-3 sm:mt-4`}>
          <form onSubmit={createSession} class="flex gap-2 mb-4 sm:mb-6">
            <input
              type="text"
              placeholder="Nueva sesión..."
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              class="flex-grow min-w-0 px-3 py-2.5 sm:py-2 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
            />
            <button
              type="submit"
              class="shrink-0 w-11 h-11 sm:w-auto sm:h-auto sm:p-2 bg-primary hover:bg-primary-dark text-white rounded-xl transition-all flex items-center justify-center"
              aria-label="Crear sesión"
            >
              <Plus class="w-4 h-4" />
            </button>
          </form>

          <div class="overflow-y-auto touch-scroll space-y-2 max-h-[40vh] lg:max-h-none lg:flex-grow">
            {loadingSessions ? (
              <div class="text-center py-6 text-gray-500 text-sm">Cargando sesiones...</div>
            ) : sessions.length === 0 ? (
              <div class="text-center py-6 text-gray-500 text-sm">No hay sesiones creadas</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveSession(s);
                    setSessionsOpen(false);
                  }}
                  class={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-2xl cursor-pointer transition-all border min-h-[48px] ${
                    activeSession?.id === s.id
                      ? 'bg-primary/10 border-primary text-white font-medium shadow-md shadow-primary/5'
                      : 'border-transparent text-gray-400 hover:bg-[#151D30] hover:text-white'
                  }`}
                >
                  <span class="truncate text-sm pr-2">{s.title}</span>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    class="p-2 text-gray-500 hover:text-red-400 rounded-lg transition-all shrink-0"
                    aria-label="Eliminar sesión"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div class="flex-grow flex flex-col bg-[#151D30]/20 border border-[#1F293D] rounded-2xl sm:rounded-3xl p-3 sm:p-6 min-w-0 relative">
        {activeSession ? (
          <>
            <div class="border-b border-[#1F293D] pb-3 sm:pb-4 mb-4 sm:mb-6">
              <h1 class="text-xl sm:text-2xl font-bold text-white break-words">{activeSession.title}</h1>
              <p class="text-[10px] sm:text-xs text-gray-400 font-mono mt-1 truncate">ID: {activeSession.id}</p>
            </div>

            <div class="mb-4 sm:mb-6 p-3 sm:p-4 bg-[#151D30]/50 border border-[#1F293D] rounded-2xl space-y-3">
              <div class="flex flex-col gap-2 sm:gap-3">
                <label class="flex items-center gap-2 text-sm text-white font-semibold">
                  <Cpu class="w-4 h-4 text-primary shrink-0" />
                  Proveedor
                </label>
                {providers.length === 0 ? (
                  <p class="text-xs text-amber-400">
                    No hay proveedores activos. Configúralos en administración.
                  </p>
                ) : (
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    disabled={actionLoading || isRecording}
                    class="w-full min-w-0 bg-[#0E1524] border border-[#1F293D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {providers.map((p) => (
                      <option key={p.type} value={p.type}>
                        {p.label || p.name}{p.isDefaultTranscription ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div class="flex flex-col gap-2 sm:gap-3">
                <label class="text-sm text-white font-semibold">Modelo free</label>
                <div class="flex gap-2 min-w-0">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={actionLoading || isRecording || loadingModels || models.length === 0}
                    class="flex-grow min-w-0 bg-[#0E1524] border border-[#1F293D] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {loadingModels ? (
                      <option value="">Cargando modelos...</option>
                    ) : models.length === 0 ? (
                      <option value="">Sin modelos free</option>
                    ) : (
                      models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => selectedProvider && fetchModels(selectedProvider)}
                    disabled={!selectedProvider || loadingModels || actionLoading || isRecording}
                    title="Recargar modelos free"
                    aria-label="Recargar modelos"
                    class="shrink-0 w-11 h-11 flex items-center justify-center border border-[#1F293D] hover:bg-[#1E2942] rounded-xl text-gray-300 disabled:opacity-50"
                  >
                    <RefreshCw class={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
              <div class="bg-[#151D30]/50 border border-[#1F293D] p-4 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[160px]">
                <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Mic class="w-4 h-4 text-primary" /> Grabación en Vivo
                </h3>

                {isRecording ? (
                  <div class="space-y-4 w-full">
                    <div class="flex justify-center items-center gap-1 h-12">
                      <div class="w-1 bg-primary rounded-full h-8 animate-pulse"></div>
                      <div class="w-1 bg-accent rounded-full h-12 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div class="w-1 bg-primary rounded-full h-6 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      <div class="w-1 bg-accent rounded-full h-10 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      <div class="w-1 bg-primary rounded-full h-8 animate-pulse" style={{ animationDelay: '0.8s' }}></div>
                    </div>

                    <div class="text-2xl font-mono font-bold text-white">{formatTime(recordingTime)}</div>

                    <div class="flex flex-col gap-2 sm:flex-row justify-center">
                      <button
                        onClick={pauseRecording}
                        class="min-h-[44px] px-4 py-2.5 border border-[#1F293D] hover:bg-[#1E2942] rounded-xl text-sm text-gray-300 transition-all"
                      >
                        {isPaused ? 'Reanudar' : 'Pausar'}
                      </button>
                      <button
                        onClick={stopRecording}
                        class="min-h-[44px] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-red-900/20"
                      >
                        Finalizar y Transcribir
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={actionLoading || !canTranscribe}
                    class="w-16 h-16 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center text-white transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50"
                    aria-label="Iniciar grabación"
                  >
                    <Mic class="w-7 h-7" />
                  </button>
                )}
                {!isRecording && (
                  <p class="text-xs text-gray-400 mt-4 px-2">Pulsa para grabar con tu micrófono.</p>
                )}
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                class={`border p-4 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center transition-all bg-[#151D30]/50 min-h-[160px] ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-[#1F293D]'
                }`}
              >
                <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Upload class="w-4 h-4 text-accent" /> Cargar Audio
                </h3>

                {uploadFile ? (
                  <div class="space-y-4 w-full">
                    <div class="p-3 bg-[#0E1524] border border-[#1F293D] rounded-xl text-xs text-gray-300 truncate max-w-full mx-auto">
                      {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                    <div class="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => setUploadFile(null)}
                        disabled={actionLoading}
                        class="min-h-[44px] px-4 py-2 border border-[#1F293D] hover:bg-[#1E2942] rounded-lg text-sm text-gray-400 hover:text-white transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={submitFile}
                        disabled={actionLoading || !canTranscribe}
                        class="min-h-[44px] px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        Subir y Transcribir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="flex flex-col items-center">
                    <label class="w-14 h-14 rounded-full border border-[#1F293D] bg-[#0B0F19] hover:bg-[#151D30] cursor-pointer flex items-center justify-center text-gray-400 hover:text-white transition-all mb-3 active:scale-95">
                      <Upload class="w-5 h-5" />
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.webm"
                        capture="user"
                        onChange={handleFileSelect}
                        class="hidden"
                        disabled={actionLoading}
                      />
                    </label>
                    <p class="text-xs text-gray-400 px-2">Toca para elegir un archivo de audio</p>
                    <span class="text-[10px] text-gray-500 mt-1">MP3, WAV, M4A, WEBM</span>
                  </div>
                )}
              </div>
            </div>

            <div class="flex-grow flex flex-col min-h-[240px]">
              <h2 class="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <Volume2 class="w-4 h-4 text-gray-400" /> Grabaciones
              </h2>

              {loadingTranscriptions ? (
                <div class="flex-grow flex items-center justify-center py-10">
                  <div class="text-center text-gray-500 space-y-2">
                    <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div class="text-sm">Cargando transcripciones...</div>
                  </div>
                </div>
              ) : transcriptions.length === 0 ? (
                <div class="flex-grow border border-dashed border-[#1F293D] rounded-2xl flex items-center justify-center p-6 sm:p-8 text-center text-gray-500 text-sm">
                  Ningún audio transcrito todavía. Graba o sube uno para empezar.
                </div>
              ) : (
                <div class="space-y-4 sm:space-y-6 overflow-y-auto touch-scroll max-h-[min(60vh,560px)] pr-0 sm:pr-2">
                  {transcriptions.map((t) => (
                    <div key={t.id} class="p-3 sm:p-5 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-3 sm:space-y-4">

                      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between border-b border-[#1F293D] pb-3 text-xs text-gray-400">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-mono text-[10px] bg-[#0E1524] px-2 py-1 rounded border border-[#1F293D]">
                            {t.id.slice(0, 8)}…
                          </span>
                          <span class="text-[11px] sm:text-xs">
                            {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary-light rounded-md">
                            {providerLabel(t.providerUsed) || t.providerUsed || 'N/A'}
                          </span>
                          <span class={`px-2 py-0.5 rounded-md ${
                            t.status === 'COMPLETED' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            t.status === 'FAILED' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                            'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                          }`}>
                            {t.status === 'COMPLETED' ? 'Completado' :
                             t.status === 'FAILED' ? 'Fallido' : 'Procesando'}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteTranscription(t.id)}
                            disabled={deletingId === t.id}
                            title="Eliminar transcripción"
                            aria-label="Eliminar transcripción"
                            class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all disabled:opacity-50 ml-auto sm:ml-0"
                          >
                            {deletingId === t.id ? (
                              <RefreshCw class="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 class="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {t.status === 'FAILED' ? (
                        <div class="text-sm text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl flex items-start gap-2 break-words">
                          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                          <span>Error: {t.errorMessage || 'No se pudo transcribir el audio'}</span>
                        </div>
                      ) : (
                        <div class="space-y-4">
                          <div>
                            <span class="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">Texto Original</span>
                            <p class="text-sm text-gray-200 bg-[#0E1524]/60 p-3 sm:p-4 border border-[#1F293D]/50 rounded-xl leading-relaxed whitespace-pre-wrap break-words">
                              {t.originalText || 'Transcribiendo audio...'}
                            </p>
                          </div>

                          {t.translations && t.translations.length > 0 && (
                            <div class="grid grid-cols-1 gap-3 sm:gap-4">
                              {t.translations.map((tr) => (
                                <div key={tr.id} class="bg-[#151D30]/20 border border-[#1F293D]/50 p-3 sm:p-4 rounded-xl">
                                  <span class="text-xs font-bold text-accent-light uppercase tracking-wider block mb-1">
                                    Traducción ({tr.targetLanguage.toUpperCase()})
                                  </span>
                                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {tr.translatedText}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {t.status === 'COMPLETED' && (
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 border-t border-[#1F293D]/50 pt-3">
                              <span class="text-xs text-gray-400 flex items-center gap-1">
                                <Globe class="w-3.5 h-3.5" /> Traducir a
                              </span>
                              <div class="flex gap-2 min-w-0">
                                <select
                                  value={targetLanguages[t.id] || 'en'}
                                  onChange={(e) => handleLangChange(t.id, e.target.value)}
                                  class="flex-grow sm:flex-grow-0 min-w-0 bg-[#0E1524] border border-[#1F293D] rounded-lg px-2.5 py-2.5 text-sm text-white focus:outline-none"
                                >
                                  <option value="en">Inglés (EN)</option>
                                  <option value="pt">Portugués (PT)</option>
                                  <option value="fr">Francés (FR)</option>
                                  <option value="de">Alemán (DE)</option>
                                  <option value="it">Italiano (IT)</option>
                                </select>
                                <button
                                  onClick={() => handleTranslate(t.id)}
                                  disabled={translatingId === t.id}
                                  class="shrink-0 min-h-[44px] px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-accent/10 disabled:opacity-50"
                                >
                                  {translatingId === t.id ? (
                                    <>
                                      <div class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>…</span>
                                    </>
                                  ) : (
                                    <span>Traducir</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div class="flex-grow flex flex-col items-center justify-center p-6 sm:p-8 text-center text-gray-500">
            <Volume2 class="w-12 h-12 sm:w-16 sm:h-16 text-gray-700 mb-4" />
            <h3 class="text-lg font-bold text-white mb-2">Comienza ahora</h3>
            <p class="max-w-xs text-sm">Crea o selecciona una sesión para empezar a transcribir.</p>
            <button
              type="button"
              onClick={() => setSessionsOpen(true)}
              class="mt-4 lg:hidden min-h-[44px] px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary-light text-sm font-medium"
            >
              Ver mis sesiones
            </button>
          </div>
        )}

        {actionLoading && (
          <div class="absolute inset-0 bg-[#0B0F19]/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl flex items-center justify-center z-40 p-4">
            <div class="text-center space-y-3">
              <Loader class="w-8 h-8 text-primary animate-spin mx-auto" />
              <div class="text-sm font-semibold text-white px-2">
                Procesando con {providerLabel(selectedProvider) || 'IA'}
                {selectedModel ? ` · ${selectedModel.split('/').pop()}` : ''}…
              </div>
              <div class="text-xs text-gray-400">Esto puede tomar unos segundos.</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
