import React, { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, UserCog, UserX, UserCheck, Trash2 } from 'lucide-react';
import { toast, confirmDialog } from './alerts';
import AdminSubnav from './AdminSubnav.jsx';

export default function UsersAdminContent({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        setUsers(await res.json());
      } else if (res.status === 403) {
        toast.error('No tienes permiso de administrador.');
        window.location.href = '/dashboard';
      } else {
        toast.error('Error al cargar usuarios.');
      }
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (user, nextRole) => {
    if (user.role === nextRole) return;

    const isSelf = user.id === currentUserId;
    const demotingSelf = isSelf && nextRole === 'USER';

    const ok = await confirmDialog({
      title: demotingSelf ? 'Quitar tu rol de admin' : 'Cambiar rol',
      message: demotingSelf
        ? `Vas a pasar tu cuenta (${user.email}) a USER y perderás acceso a administración. ¿Continuar?`
        : `¿Cambiar a ${user.email} de ${user.role} a ${nextRole}?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: demotingSelf ? 'danger' : 'warning',
    });
    if (!ok) return;

    setUpdatingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo actualizar el rol');
        return;
      }

      if (data.selfDemoted) {
        toast.warning(data.message || 'Ya no eres administrador');
        window.location.href = '/dashboard';
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: data.user.role } : u))
      );
      toast.success(`Rol de ${user.email} → ${nextRole}`);
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleActive = async (user) => {
    const nextActive = !user.isActive;
    const isSelf = user.id === currentUserId;

    const ok = await confirmDialog({
      title: nextActive ? 'Activar usuario' : 'Inactivar usuario',
      message: nextActive
        ? `¿Reactivar a ${user.email}? Podrá iniciar sesión de nuevo.`
        : isSelf
          ? `Vas a inactivar tu propia cuenta (${user.email}). Se cerrará tu sesión y no podrás volver a entrar hasta que otro admin te reactive.`
          : `¿Inactivar a ${user.email}? No podrá iniciar sesión. Preferible a eliminar si solo querés bloquear el acceso.`,
      confirmLabel: nextActive ? 'Activar' : 'Inactivar',
      cancelLabel: 'Cancelar',
      variant: nextActive ? 'info' : 'warning',
    });
    if (!ok) return;

    setUpdatingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo actualizar el estado');
        return;
      }

      if (data.selfDeactivated) {
        toast.warning(data.message || 'Cuenta desactivada');
        window.location.href = '/login';
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: data.user.isActive } : u))
      );
      toast.success(nextActive ? `${user.email} activado` : `${user.email} inactivado`);
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteUser = async (user) => {
    if (user.id === currentUserId) {
      toast.error('No puedes eliminar tu propia cuenta.');
      return;
    }

    const ok = await confirmDialog({
      title: 'Eliminar usuario',
      message: `Se eliminará permanentemente a ${user.email}, sus sesiones y grabaciones. Si solo querés bloquear el acceso, usá Inactivar.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    setUpdatingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'No se pudo eliminar el usuario');
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(data.message || 'Usuario eliminado');
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div class="flex-grow flex items-center justify-center p-8">
        <div class="text-center text-gray-400 space-y-3">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div class="text-sm">Cargando usuarios...</div>
        </div>
      </div>
    );
  }

  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;

  return (
    <div class="max-w-4xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100vh-4rem)] flex flex-col justify-start">
      <div class="flex flex-col gap-4 border-b border-[#1F293D] pb-4 sm:pb-5">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
              <Users class="w-7 h-7 sm:w-8 sm:h-8 text-accent shrink-0" />
              <span class="leading-tight">Usuarios</span>
            </h1>
            <p class="text-sm text-gray-400 mt-1.5">
              Roles, inactivar (bloquear login) o eliminar. Preferí inactivar antes de borrar.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            class="self-start min-h-[40px] px-3 py-2 rounded-xl border border-[#1F293D] text-gray-300 hover:bg-[#1E2942] text-sm flex items-center gap-1.5"
          >
            <RefreshCw class="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>
        <AdminSubnav active="users" />
      </div>

      <div class="flex flex-wrap gap-3 text-xs text-gray-400">
        <span class="px-2.5 py-1 rounded-lg bg-[#151D30] border border-[#1F293D]">
          Total: <strong class="text-white">{users.length}</strong>
        </span>
        <span class="px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent-light">
          Admins activos: <strong>{activeAdmins}</strong>
        </span>
        {inactiveCount > 0 && (
          <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
            Inactivos: <strong>{inactiveCount}</strong>
          </span>
        )}
      </div>

      <div class="space-y-3">
        {users.length === 0 ? (
          <div class="text-center py-12 text-gray-500 text-sm border border-dashed border-[#1F293D] rounded-2xl">
            No hay usuarios registrados.
          </div>
        ) : (
          users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isLastActiveAdmin = user.role === 'ADMIN' && user.isActive && activeAdmins <= 1;
            const busy = updatingId === user.id;

            return (
              <div
                key={user.id}
                class={`p-4 sm:p-5 border rounded-2xl flex flex-col gap-4 ${
                  user.isActive
                    ? 'bg-[#151D30]/40 border-[#1F293D]'
                    : 'bg-[#151D30]/20 border-amber-900/40 opacity-90'
                }`}
              >
                <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div class="flex-grow min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-white truncate">{user.email}</p>
                      {isSelf && (
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary-light border border-primary/25">
                          Tú
                        </span>
                      )}
                      <span
                        class={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          user.role === 'ADMIN'
                            ? 'bg-accent/15 text-accent-light border border-accent/25'
                            : 'bg-[#0E1524] text-gray-400 border border-[#1F293D]'
                        }`}
                      >
                        {user.role}
                      </span>
                      <span
                        class={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          user.isActive
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                        }`}
                      >
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500">
                      Alta: {new Date(user.createdAt).toLocaleDateString()} · Sesiones: {user.sessionsCount ?? 0}
                    </p>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <UserCog class="w-4 h-4 text-gray-500 hidden sm:block" />
                    <select
                      value={user.role}
                      disabled={busy || isLastActiveAdmin}
                      title={isLastActiveAdmin ? 'No se puede degradar al único admin activo' : 'Cambiar rol'}
                      onChange={(e) => changeRole(user, e.target.value)}
                      class="min-h-[44px] min-w-[8.5rem] bg-[#0E1524] border border-[#1F293D] rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 border-t border-[#1F293D]/60 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(user)}
                    disabled={busy || (user.isActive && isLastActiveAdmin)}
                    title={
                      user.isActive && isLastActiveAdmin
                        ? 'No se puede inactivar al único admin activo'
                        : undefined
                    }
                    class={`min-h-[40px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 border ${
                      user.isActive
                        ? 'border-amber-800/40 text-amber-300 hover:bg-amber-950/40'
                        : 'border-green-800/40 text-green-400 hover:bg-green-950/30'
                    }`}
                  >
                    {user.isActive ? (
                      <>
                        <UserX class="w-3.5 h-3.5" /> Inactivar
                      </>
                    ) : (
                      <>
                        <UserCheck class="w-3.5 h-3.5" /> Activar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteUser(user)}
                    disabled={busy || isSelf || isLastActiveAdmin}
                    title={
                      isSelf
                        ? 'No puedes eliminarte a ti mismo'
                        : isLastActiveAdmin
                          ? 'No se puede eliminar al único admin activo'
                          : 'Eliminar permanentemente'
                    }
                    class="min-h-[40px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 border border-red-900/40 text-red-400 hover:bg-red-950/40 transition-all disabled:opacity-50 ml-auto"
                  >
                    <Trash2 class="w-3.5 h-3.5" /> Eliminar
                  </button>

                  {busy && <RefreshCw class="w-4 h-4 animate-spin text-primary self-center" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p class="text-[11px] text-gray-500 flex items-start gap-2">
        <Shield class="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
        Inactivar bloquea el login y cierra sesiones. Eliminar es permanente. Debe quedar al menos un ADMIN activo.
      </p>
    </div>
  );
}
