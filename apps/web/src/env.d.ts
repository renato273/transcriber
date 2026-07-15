/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      email: string;
      role: 'USER' | 'ADMIN';
    } | null;
  }
}

interface AlertsApi {
  toast: {
    success: (message: string, options?: Record<string, unknown>) => number;
    error: (message: string, options?: Record<string, unknown>) => number;
    warning: (message: string, options?: Record<string, unknown>) => number;
    info: (message: string, options?: Record<string, unknown>) => number;
  };
  confirm: (options: string | Record<string, unknown>) => Promise<boolean>;
}

interface Window {
  alerts?: AlertsApi;
}
