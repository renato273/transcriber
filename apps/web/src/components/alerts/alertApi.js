/**
 * API global de alertas (toasts + diálogo de confirmación).
 * Funciona desde React y desde scripts vanilla (Astro).
 */

const listeners = new Set();

function emit(event) {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.error('Alert listener error:', e);
    }
  });
}

export function subscribeAlerts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let toastId = 0;

function pushToast(variant, message, options = {}) {
  const id = ++toastId;
  emit({
    kind: 'toast',
    id,
    variant,
    message: String(message || ''),
    title: options.title,
    duration: options.duration ?? (variant === 'error' ? 6000 : 4000),
  });
  return id;
}

export const toast = {
  success: (message, options) => pushToast('success', message, options),
  error: (message, options) => pushToast('error', message, options),
  warning: (message, options) => pushToast('warning', message, options),
  info: (message, options) => pushToast('info', message, options),
};

/**
 * Diálogo modal de confirmación. Resuelve true/false.
 */
export function confirmDialog(options = {}) {
  const {
    title = 'Confirmar',
    message = '¿Deseas continuar?',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'warning', // danger | warning | info
  } = typeof options === 'string' ? { message: options } : options;

  return new Promise((resolve) => {
    emit({
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
      resolve,
    });
  });
}

/** Expone la API en window para usarla desde scripts Astro. */
export function installAlertsOnWindow() {
  if (typeof window === 'undefined') return;
  window.alerts = { toast, confirm: confirmDialog };
}
