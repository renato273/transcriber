import React from 'react';
import { Check, X } from 'lucide-react';
import { getPasswordChecks, PASSWORD_RULES } from '../lib/password.js';

export default function PasswordChecklist({ password = '' }) {
  const checks = getPasswordChecks(password);

  return (
    <ul class="space-y-1.5 mt-2" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = checks[rule.key];
        return (
          <li
            key={rule.key}
            class={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-gray-500'}`}
          >
            <span
              class={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                ok ? 'bg-green-500/15 border-green-500/40' : 'bg-[#0E1524] border-[#1F293D]'
              }`}
            >
              {ok ? <Check class="w-2.5 h-2.5" /> : <X class="w-2.5 h-2.5" />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
