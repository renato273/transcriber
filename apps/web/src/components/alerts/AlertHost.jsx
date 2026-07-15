import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeAlerts, installAlertsOnWindow } from './alertApi.js';

const VARIANT_STYLES = {
  success: {
    border: 'border-green-500/30',
    bg: 'bg-green-950/90',
    text: 'text-green-300',
    icon: CheckCircle,
    bar: 'bg-green-500',
  },
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-950/90',
    text: 'text-red-300',
    icon: AlertCircle,
    bar: 'bg-red-500',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/90',
    text: 'text-amber-300',
    icon: AlertTriangle,
    bar: 'bg-amber-500',
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-950/90',
    text: 'text-blue-300',
    icon: Info,
    bar: 'bg-blue-500',
  },
};

const CONFIRM_STYLES = {
  danger: {
    btn: 'bg-red-600 hover:bg-red-700 shadow-red-900/30',
    iconWrap: 'bg-red-500/15 text-red-400',
    Icon: AlertCircle,
  },
  warning: {
    btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/30',
    iconWrap: 'bg-amber-500/15 text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    btn: 'bg-primary hover:bg-primary-dark shadow-primary/20',
    iconWrap: 'bg-primary/15 text-primary-light',
    Icon: Info,
  },
};

function ToastItem({ toast, onClose }) {
  const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;
  const Icon = style.icon;

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return undefined;
    const t = setTimeout(() => onClose(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      role="status"
      class={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border backdrop-blur-md shadow-xl shadow-black/40 ${style.border} ${style.bg}`}
      style={{ animation: 'alertSlideIn 0.25s ease-out' }}
    >
      <div class={`h-0.5 w-full ${style.bar} opacity-80`} />
      <div class="p-3.5 flex items-start gap-3">
        <Icon class={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} />
        <div class="flex-grow min-w-0">
          {toast.title && (
            <p class={`text-sm font-semibold ${style.text}`}>{toast.title}</p>
          )}
          <p class={`text-sm text-gray-200 leading-snug ${toast.title ? 'mt-0.5' : ''}`}>
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          class="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all shrink-0"
          aria-label="Cerrar"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AlertHost() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    installAlertsOnWindow();

    const unsubscribe = subscribeAlerts((event) => {
      if (event.kind === 'toast') {
        setToasts((prev) => [...prev.slice(-4), event]);
      }
      if (event.kind === 'confirm') {
        setConfirm(event);
      }
    });

    return unsubscribe;
  }, []);

  const closeConfirm = (value) => {
    if (confirm?.resolve) confirm.resolve(value);
    setConfirm(null);
  };

  const confirmStyle = CONFIRM_STYLES[confirm?.variant] || CONFIRM_STYLES.warning;
  const ConfirmIcon = confirmStyle.Icon;

  return (
    <>
      <div class="fixed top-[calc(3.5rem+0.75rem+env(safe-area-inset-top))] sm:top-20 left-3 right-3 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2.5 w-auto sm:w-[min(100vw-2rem,24rem)] pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} />
        ))}
      </div>

      {confirm && (
        <div class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            class="absolute inset-0 bg-[#0B0F19]/75 backdrop-blur-sm"
            onClick={() => closeConfirm(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            class="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#1F293D] bg-[#151D30] shadow-2xl shadow-black/50 p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
            style={{ animation: 'alertFadeScale 0.2s ease-out' }}
          >
            <div class="flex items-start gap-4">
              <div class={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${confirmStyle.iconWrap}`}>
                <ConfirmIcon class="w-5 h-5" />
              </div>
              <div class="min-w-0 flex-grow">
                <h3 class="text-lg font-bold text-white">{confirm.title}</h3>
                <p class="mt-1.5 text-sm text-gray-400 leading-relaxed">{confirm.message}</p>
              </div>
            </div>

            <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                class="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border border-[#1F293D] text-gray-300 hover:bg-[#1E2942] hover:text-white transition-all"
              >
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                class={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all ${confirmStyle.btn}`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
