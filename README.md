# AI Transcriber & Translator

Aplicación web para **transcribir audio** (micrófono o archivo) y **traducirlo** usando capas gratuitas de IA (Google Gemini, NVIDIA, OpenRouter, Mistral, Groq, GitHub Models).

Monorepo con Astro (SSR) + React, PostgreSQL/Prisma y despliegue por imagen Docker publicada en Docker Hub al hacer merge a `main`.

---

## Stack

| Capa | Tecnología |
|------|------------|
| App | Astro 4 (SSR Node) + React + Tailwind |
| DB | PostgreSQL + Prisma |
| Monorepo | pnpm workspaces + Turbo |
| Deploy | Docker multi-stage + GitHub Actions → Docker Hub |

---

## Estructura

```text
transcriber/
├── apps/web/                 # Astro + React (UI + API routes)
├── packages/
│   ├── database/             # Prisma schema, migraciones, encrypt
│   └── ai-services/          # Adaptadores de proveedores de IA
├── docker/entrypoint.sh      # Migraciones Prisma al arrancar el contenedor
├── Dockerfile
├── .github/workflows/
│   └── docker-publish.yml    # Build & push a Docker Hub en push a main
└── docs/                     # Arquitectura, DB, APIs
```

---

## Variables de entorno

Creá un `.env` en la **raíz** del repo (no lo subas a Git).

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | Connection string PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar cookies de sesión |
| `ENCRYPTION_KEY` | Sí | Clave para cifrar API keys en la BD. **Si la cambiás, hay que volver a guardar las API keys en Admin** |
| `COOKIE_SECURE` | No | `false` en HTTP/LAN. `true` solo con HTTPS. Si falta, se detecta por el protocolo de la request |
| `AUDIO_STORAGE_PATH` | No | Carpeta de audios (default `./storage/audio`; en Docker: `/app/storage/audio`) |
| `HOST` | No | En Docker/producción: `0.0.0.0` |
| `PORT` | No | Puerto HTTP (default contenedor: `4321`) |
| `NODE_ENV` | No | `production` en deploy |

Ejemplo:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/transcriber"
JWT_SECRET="cambia-este-secreto-largo"
ENCRYPTION_KEY="cambia-esta-clave-de-cifrado"
COOKIE_SECURE=false
AUDIO_STORAGE_PATH="./storage/audio"
HOST=0.0.0.0
PORT=4321
NODE_ENV=production
```

> En acceso por IP/LAN (`http://192.168.x.x`) dejá `COOKIE_SECURE=false`. Con `true` (o cookie Secure forzada) el login parece OK pero no guarda la sesión.
> Las API keys de Gemini/NVIDIA/etc. **no van en el `.env`**: se configuran en la UI de administración y se guardan cifradas en la base.

---

## Desarrollo local

### Requisitos

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)
- PostgreSQL accesible

### Pasos

```bash
pnpm install

# .env en la raíz (ver tabla arriba)

# Migraciones
cd packages/database
pnpm exec dotenv -e ../../.env -- prisma migrate deploy
pnpm exec prisma generate
cd ../..

# (opcional) compilar packages
pnpm --filter @transcriber/database build
pnpm --filter @transcriber/ai-services build

# Dev server → http://localhost:4321
# Desde otro dispositivo en la misma red → http://TU_IP_LAN:4321
pnpm dev
```

En Windows, si no carga desde el celular/otra PC, permití el puerto en el Firewall (primera vez que escucha en la red):

```powershell
New-NetFirewallRule -DisplayName "Transcriber Astro Dev" -Direction Inbound -Protocol TCP -LocalPort 4321 -Action Allow
```

Para ver tu IP local: `ipconfig` (buscá IPv4 de Wi‑Fi/Ethernet).

Alternativa de migración en desarrollo:

```bash
pnpm --filter @transcriber/database db:migrate
```

### Primer usuario

El **primer registro** del sistema se crea como `ADMIN`. Los siguientes como `USER`.

---

## Deploy con Docker

### 1) Publicación automática (GitHub Actions)

Al hacer **push/merge a `main`**, el workflow `.github/workflows/docker-publish.yml`:

1. Builda la imagen con el `Dockerfile`
2. La publica en Docker Hub como:

```text
{DOCKERHUB_USERNAME}/transcriber-ai:latest
{DOCKERHUB_USERNAME}/transcriber-ai:sha-xxxxx
```

**Secrets del repositorio** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Descripción |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Access Token de Docker Hub (Account Settings → Security) |

También se puede disparar manualmente: Actions → **Build and Push to Docker Hub** → Run workflow.

### 2) Build local de la imagen (opcional)

```bash
docker build -t transcriber-ai:local .
```

### 3) Ejecutar el contenedor

El `entrypoint` aplica `prisma migrate deploy` al inicio y luego arranca Astro (`node apps/web/dist/server/entry.mjs`).

```bash
docker run -d \
  --name transcriber \
  -p 4321:4321 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/transcriber" \
  -e JWT_SECRET="cambia-este-secreto-largo" \
  -e ENCRYPTION_KEY="cambia-esta-clave-de-cifrado" \
  -e HOST=0.0.0.0 \
  -e PORT=4321 \
  -e NODE_ENV=production \
  -e AUDIO_STORAGE_PATH="/app/storage/audio" \
  -v transcriber_audio:/app/storage/audio \
  {DOCKERHUB_USERNAME}/transcriber-ai:latest
```

Notas:

- PostgreSQL debe ser alcanzable desde el contenedor (usa IP/host de la red, no `localhost` salvo que sea la misma máquina con `--network host` o similar).
- Montá un volumen en `/app/storage/audio` si querés persistir los audios entre reinicios.
- `ENCRYPTION_KEY` debe ser **estable** entre deploys; si cambia, las API keys guardadas dejan de desencriptarse y hay que re-pegarlas en Admin.

### 4) Health check rápido

```bash
curl -I http://localhost:4321/
```

---

## Después del deploy (configuración)

1. Abrí la app y **registrá** el primer usuario (queda como ADMIN), o usá uno existente.
2. Entrá a **API Keys / Proveedores** (`/admin`) y cargá las keys de los proveedores que uses. Activalos y marcá defaults de transcripción/traducción.
3. Opcional: **Usuarios** (`/admin/users`) para roles (`ADMIN`/`USER`), inactivar, eliminar o cambiar contraseña.

Solo los **ADMIN** ven y acceden a `/admin` y `/admin/users`.

## Registro de usuarios

1. Si **no hay usuarios**, `/register` permite crear el **primer ADMIN**.
2. Al crearlo, el registro público se **cierra solo**.
3. Un ADMIN puede reabrir altas en **API Keys / Proveedores → Ajustes → “Permitir registro de nuevos usuarios”**.
4. Con el registro cerrado, las rutas y botones de “Registrarse” se ocultan; la API responde `403`.

### Contraseñas

Deben cumplir:

- ≥ 8 caracteres  
- 1 mayúscula  
- 1 minúscula  
- 1 carácter especial  

(validación en registro y al cambiar clave desde admin)

---

## Comandos útiles

```bash
pnpm dev                                          # desarrollo
pnpm build                                        # build monorepo
pnpm --filter @transcriber/database db:generate   # regenerar Prisma Client
pnpm --filter @transcriber/ai-services build      # rebuild adaptadores IA
```

---

## Documentación adicional

- [Arquitectura](docs/architecture.md)
- [Base de datos](docs/database.md)
- [Integración de APIs](docs/api_integration.md)
- [Agentes de desarrollo](docs/agents.md)

---

## Licencia / uso

Uso interno / MVP. Revisá los términos de cada proveedor de IA (cuotas free tier) antes de producción.
