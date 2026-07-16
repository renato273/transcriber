import React from 'react';
import { Key, Users } from 'lucide-react';

/**
 * Subnavegación del panel admin (solo visible para ADMIN).
 */
export default function AdminSubnav({ active = 'providers' }) {
  const linkClass = (id) =>
    `flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
      active === id
        ? 'bg-accent/15 border-accent/40 text-accent-light'
        : 'border-[#1F293D] text-gray-400 hover:text-white hover:bg-[#151D30]'
    }`;

  return (
    <nav class="flex flex-col sm:flex-row gap-2" aria-label="Secciones de administración">
      <a href="/admin" class={linkClass('providers')}>
        <Key class="w-4 h-4" />
        API Keys / Proveedores
      </a>
      <a href="/admin/users" class={linkClass('users')}>
        <Users class="w-4 h-4" />
        Usuarios
      </a>
    </nav>
  );
}
