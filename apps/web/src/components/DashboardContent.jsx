import React, { useState, useEffect, useRef } from 'react';
import { Mic, Upload, Trash2, Plus, Volume2, Globe, Check, AlertCircle, Loader } from 'lucide-react';

export default function DashboardContent() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [transcriptions, setTranscriptions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const timerRef = useRef(null);

  // File Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Translation state
  const [translatingId, setTranslatingId] = useState(null);
  const [targetLanguages, setTargetLanguages] = useState({}); // { transcriptionId: langCode }

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch all sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Fetch transcriptions when activeSession changes
  useEffect(() => {
    if (activeSession) {
      fetchSessionDetails(activeSession.id);
    } else {
      setTranscriptions([]);
    }
  }, [activeSession]);

  // Recording Timer
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
    setErrorMsg('');
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTranscriptions(data.transcriptions || []);
      }
    } catch (e) {
      setErrorMsg('Error al cargar grabaciones');
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar esta sesión y todas sus grabaciones?')) return;

    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = sessions.filter(s => s.id !== id);
        setSessions(remaining);
        if (activeSession?.id === id) {
          setActiveSession(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- RECORDING FUNCTIONS ---
  const startRecording = async () => {
    setAudioChunks([]);
    setRecordingTime(0);
    setErrorMsg('');

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
        
        // Stop all stream tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      setErrorMsg('No se pudo acceder al micrófono. Verifica los permisos.');
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

  // --- FILE UPLOAD FUNCTIONS ---
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
        setErrorMsg('Por favor, arrastra solo archivos de audio');
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
    setActionLoading(true);
    setErrorMsg('');
    try {
      await handleAudioUpload(uploadFile, uploadFile.name);
      setUploadFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // --- COMMMON UPLOAD/TRANSCRIBE LOGIC ---
  const handleAudioUpload = async (audioBlob, fileName) => {
    if (!activeSession) return;
    setActionLoading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('audio', audioBlob, fileName);
    formData.append('sessionId', activeSession.id);
    formData.append('language', 'es');

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        // Reload session details to include the new transcription
        await fetchSessionDetails(activeSession.id);
      } else {
        setErrorMsg(data.error || 'Error al procesar la transcripción');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con el servidor');
    } finally {
      setActionLoading(false);
    }
  };

  // --- TRANSLATION LOGIC ---
  const handleTranslate = async (transcriptionId) => {
    const lang = targetLanguages[transcriptionId] || 'en';
    setTranslatingId(transcriptionId);
    setErrorMsg('');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptionId, targetLanguage: lang })
      });

      const data = await res.json();
      if (res.ok) {
        // Refresh session transcriptions to pull new translations list
        await fetchSessionDetails(activeSession.id);
      } else {
        setErrorMsg(data.error || 'Error al traducir');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con el servidor');
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

  return (
    <div class="flex-grow flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 min-h-[calc(100vh-4rem)]">
      
      {/* SIDEBAR: SESSIONS LIST */}
      <div class="w-full md:w-80 flex flex-col bg-[#151D30]/40 border border-[#1F293D] rounded-3xl p-5 shrink-0">
        <h2 class="text-lg font-bold text-white mb-4 flex items-center justify-between">
          <span>Mis Sesiones</span>
          <Plus class="w-4 h-4 text-gray-400" />
        </h2>

        <form onSubmit={createSession} class="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Nueva sesión..."
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            class="flex-grow px-3 py-2 text-sm bg-[#0E1524] border border-[#1F293D] rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-white"
          />
          <button
            type="submit"
            class="p-2 bg-primary hover:bg-primary-dark text-white rounded-xl transition-all"
          >
            <Plus class="w-4 h-4" />
          </button>
        </form>

        <div class="flex-grow overflow-y-auto space-y-2 max-h-[300px] md:max-h-none">
          {loadingSessions ? (
            <div class="text-center py-8 text-gray-500 text-sm">Cargando sesiones...</div>
          ) : sessions.length === 0 ? (
            <div class="text-center py-8 text-gray-500 text-sm">No hay sesiones creadas</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSession(s)}
                class={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all border ${
                  activeSession?.id === s.id
                    ? 'bg-primary/10 border-primary text-white font-medium shadow-md shadow-primary/5'
                    : 'border-transparent text-gray-400 hover:bg-[#151D30] hover:text-white'
                }`}
              >
                <span class="truncate text-sm pr-2">{s.title}</span>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  class="p-1 text-gray-500 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CONTAINER: TRANSCRIPTION WORKSPACE */}
      <div class="flex-grow flex flex-col bg-[#151D30]/20 border border-[#1F293D] rounded-3xl p-6 min-w-0 relative">
        {activeSession ? (
          <>
            {/* Header of Active Session */}
            <div class="border-b border-[#1F293D] pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 class="text-2xl font-bold text-white">{activeSession.title}</h1>
                <p class="text-xs text-gray-400 font-mono mt-1">ID: {activeSession.id}</p>
              </div>
              
              {/* Alert Notification */}
              {errorMsg && (
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 text-xs">
                  <AlertCircle class="w-3.5 h-3.5" />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* CONTROLS AREA: RECORDING AND UPLOADING CONTAINER */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              
              {/* MICROPHONE RECORDING BOX */}
              <div class="bg-[#151D30]/50 border border-[#1F293D] p-5 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Mic class="w-4 h-4 text-primary" /> Grabación en Vivo
                </h3>

                {isRecording ? (
                  <div class="space-y-4 w-full">
                    {/* Animated sound wave mimicking */}
                    <div class="flex justify-center items-center gap-1 h-12">
                      <div class="w-1 bg-primary rounded-full h-8 animate-pulse"></div>
                      <div class="w-1 bg-accent rounded-full h-12 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div class="w-1 bg-primary rounded-full h-6 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      <div class="w-1 bg-accent rounded-full h-10 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      <div class="w-1 bg-primary rounded-full h-8 animate-pulse" style={{ animationDelay: '0.8s' }}></div>
                    </div>

                    <div class="text-2xl font-mono font-bold text-white">{formatTime(recordingTime)}</div>

                    <div class="flex gap-2 justify-center">
                      <button
                        onClick={pauseRecording}
                        class="px-4 py-2 border border-[#1F293D] hover:bg-[#1E2942] rounded-xl text-xs text-gray-300 transition-all"
                      >
                        {isPaused ? 'Reanudar' : 'Pausar'}
                      </button>
                      <button
                        onClick={stopRecording}
                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-red-900/20"
                      >
                        Finalizar y Transcribir
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={actionLoading}
                    class="w-16 h-16 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center text-white transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Mic class="w-7 h-7" />
                  </button>
                )}
                {!isRecording && (
                  <p class="text-xs text-gray-400 mt-4">Pulsa el botón para iniciar grabación con tu micrófono.</p>
                )}
              </div>

              {/* FILE UPLOAD BOX */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                class={`border p-5 rounded-2xl flex flex-col items-center justify-center text-center transition-all bg-[#151D30]/50 ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-[#1F293D]'
                }`}
              >
                <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Upload class="w-4 h-4 text-accent" /> Cargar Archivo de Audio
                </h3>

                {uploadFile ? (
                  <div class="space-y-4 w-full">
                    <div class="p-3 bg-[#0E1524] border border-[#1F293D] rounded-xl text-xs text-gray-300 truncate max-w-[250px] mx-auto">
                      {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                    <div class="flex gap-2 justify-center">
                      <button
                        onClick={() => setUploadFile(null)}
                        disabled={actionLoading}
                        class="px-3 py-1.5 border border-[#1F293D] hover:bg-[#1E2942] rounded-lg text-xs text-gray-400 hover:text-white transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={submitFile}
                        disabled={actionLoading}
                        class="px-4 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-lg text-xs font-semibold transition-all"
                      >
                        Subir y Transcribir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="flex flex-col items-center">
                    <label class="w-12 h-12 rounded-full border border-[#1F293D] bg-[#0B0F19] hover:bg-[#151D30] cursor-pointer flex items-center justify-center text-gray-400 hover:text-white transition-all mb-3">
                      <Upload class="w-5 h-5" />
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileSelect}
                        class="hidden"
                        disabled={actionLoading}
                      />
                    </label>
                    <p class="text-xs text-gray-400">Arrastra tu archivo aquí o haz clic en el icono</p>
                    <span class="text-[10px] text-gray-500 mt-1">Formatos soportados: MP3, WAV, M4A, WEBM</span>
                  </div>
                )}
              </div>
            </div>

            {/* LIST OF COMPLETED TRANSCRIPTIONS */}
            <div class="flex-grow flex flex-col min-h-[300px]">
              <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Volume2 class="w-4 h-4 text-gray-400" /> Grabaciones en esta sesión
              </h2>

              {loadingTranscriptions ? (
                <div class="flex-grow flex items-center justify-center">
                  <div class="text-center text-gray-500 space-y-2">
                    <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div class="text-sm">Cargando transcripciones...</div>
                  </div>
                </div>
              ) : transcriptions.length === 0 ? (
                <div class="flex-grow border border-dashed border-[#1F293D] rounded-2xl flex items-center justify-center p-8 text-center text-gray-500 text-sm">
                  Ningún audio transcrito todavía en esta sesión. ¡Empieza grabando o subiendo uno!
                </div>
              ) : (
                <div class="space-y-6 overflow-y-auto max-h-[500px] pr-2">
                  {transcriptions.map((t) => (
                    <div key={t.id} class="p-5 bg-[#151D30]/40 border border-[#1F293D] rounded-2xl space-y-4">
                      
                      {/* Transcription Info header */}
                      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F293D] pb-3 text-xs text-gray-400">
                        <div class="flex items-center gap-3">
                          <span class="font-mono text-[10px] bg-[#0E1524] px-2 py-1 rounded border border-[#1F293D]">
                            ID: {t.id.slice(0, 8)}...
                          </span>
                          <span>Fecha: {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary-light rounded-md">
                            IA: {t.providerUsed || 'Gemini'}
                          </span>
                          <span class={`px-2 py-0.5 rounded-md ${
                            t.status === 'COMPLETED' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            t.status === 'FAILED' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                            'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                          }`}>
                            {t.status === 'COMPLETED' ? 'Completado' :
                             t.status === 'FAILED' ? 'Fallido' : 'Procesando'}
                          </span>
                        </div>
                      </div>

                      {/* Content Area */}
                      {t.status === 'FAILED' ? (
                        <div class="text-sm text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl flex items-start gap-2">
                          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                          <span>Error: {t.errorMessage || 'No se pudo transcribir el audio'}</span>
                        </div>
                      ) : (
                        <div class="space-y-4">
                          {/* Transcription text */}
                          <div>
                            <span class="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">Texto Original (es)</span>
                            <p class="text-sm text-gray-200 bg-[#0E1524]/60 p-4 border border-[#1F293D]/50 rounded-xl leading-relaxed whitespace-pre-wrap">
                              {t.originalText || 'Transcribiendo audio...'}
                            </p>
                          </div>

                          {/* Translations List (if any) */}
                          {t.translations && t.translations.length > 0 && (
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {t.translations.map((tr) => (
                                <div key={tr.id} class="bg-[#151D30]/20 border border-[#1F293D]/50 p-4 rounded-xl">
                                  <span class="text-xs font-bold text-accent-light uppercase tracking-wider block mb-1">
                                    Traducción ({tr.targetLanguage.toUpperCase()})
                                  </span>
                                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {tr.translatedText}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Translation Tool Trigger */}
                          {t.status === 'COMPLETED' && (
                            <div class="flex items-center justify-end gap-3 border-t border-[#1F293D]/50 pt-3">
                              <span class="text-xs text-gray-400 flex items-center gap-1">
                                <Globe class="w-3.5 h-3.5" /> Traducir a:
                              </span>
                              <select
                                value={targetLanguages[t.id] || 'en'}
                                onChange={(e) => handleLangChange(t.id, e.target.value)}
                                class="bg-[#0E1524] border border-[#1F293D] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
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
                                class="px-3.5 py-1 bg-accent hover:bg-accent-dark text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-accent/10 disabled:opacity-50"
                              >
                                {translatingId === t.id ? (
                                  <>
                                    <div class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Traduciendo...</span>
                                  </>
                                ) : (
                                  <span>Traducir</span>
                                )}
                              </button>
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
          <div class="flex-grow flex flex-col items-center justify-center p-8 text-center text-gray-500">
            <Volume2 class="w-16 h-16 text-gray-700 mb-4" />
            <h3 class="text-lg font-bold text-white mb-2">Comienza ahora</h3>
            <p class="max-w-xs text-sm">Crea una nueva sesión en la barra lateral o selecciona una existente para empezar tus transcripciones.</p>
          </div>
        )}

        {/* Global Action overlay loaders */}
        {actionLoading && (
          <div class="absolute inset-0 bg-[#0B0F19]/60 backdrop-blur-sm rounded-3xl flex items-center justify-center z-40">
            <div class="text-center space-y-3">
              <Loader class="w-8 h-8 text-primary animate-spin mx-auto" />
              <div class="text-sm font-semibold text-white">Procesando audio por IA...</div>
              <div class="text-xs text-gray-400">Esto puede tomar unos segundos.</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
