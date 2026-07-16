# AI Transcriber & Translator (Monorepo)

Este es un proyecto web monorepo diseñado para la transcripción de audio (grabado en vivo o subido mediante archivos) y su posterior traducción a múltiples idiomas mediante el uso de proveedores de Inteligencia Artificial gratuitos (Google Gemini, NVIDIA NIM, OpenRouter).

## Stack Tecnológico

* **Frontend & Backend (API)**: [Astro](https://astro.build/) con la integración de [React](https://react.dev/) para componentes interactivos y reactivos en el cliente.
* **Base de Datos**: [PostgreSQL](https://www.postgresql.org/).
* **ORM**: [Prisma](https://www.prisma.io/).
* **Estilos**: [Tailwind CSS](https://tailwindcss.com/) (configurado en la aplicación frontend de Astro).
* **Gestor de Monorepo**: `pnpm` workspaces (recomendado por velocidad y eficiencia de espacio).

---

## Estructura del Monorepo

El proyecto está organizado como un monorepo para separar limpiamente la interfaz de usuario, la configuración de la base de datos y la lógica compartida de servicios:

```text
transcriber/
├── apps/
│   └── web/                     # Aplicación principal en Astro + React
│       ├── public/              # Archivos públicos estáticos
│       └── src/
│           ├── components/      # Componentes React e islas de Astro
│           ├── layouts/         # Layouts base de la página
│           ├── pages/           # Páginas y rutas de la API de Astro
│           └── env.d.ts         # Tipados de variables de entorno
├── packages/
│   ├── database/                # Package de base de datos con Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Esquema de la base de datos
│   │   ├── src/                 # Cliente exportable de Prisma
│   │   └── package.json
│   └── ai-services/             # Lógica compartida para interactuar con proveedores de IA
│       ├── src/                 # Adaptadores de Google, Nvidia y OpenRouter
│       └── package.json
├── docs/                        # Documentación detallada del proyecto
│   ├── architecture.md          # Arquitectura del sistema y flujo de datos
│   ├── database.md              # Diseño de base de datos y esquema
│   ├── api_integration.md       # API y configuración de proveedores de IA
│   └── agents.md                # Agentes de IA sugeridos para el desarrollo
├── package.json                 # Configuración raíz de pnpm workspaces
├── pnpm-workspace.yaml          # Definición de workspaces
└── README.md                    # Este archivo
```

---

## Documentación Detallada

Para comprender a fondo la implementación del proyecto, lee los siguientes documentos en la carpeta `docs/`:

1. [**Arquitectura (`docs/architecture.md`)**](docs/architecture.md): Detalles sobre la comunicación frontend-backend, gestión de grabaciones, almacenamiento local de audios y scripts de limpieza.
2. [**Base de Datos (`docs/database.md`)**](docs/database.md): Detalle del esquema de base de datos PostgreSQL, migraciones de Prisma y modelos de datos.
3. [**Integración de APIs (`docs/api_integration.md`)**](docs/api_integration.md): Endpoints de la API, integración con Google Gemini, NVIDIA NIM y OpenRouter, y la configuración de API Keys gratuitas.
4. [**Agentes de Desarrollo (`docs/agents.md`)**](docs/agents.md): Definición de los agentes de IA necesarios para programar la aplicación.

---

## Requisitos Previos

* Node.js v18 o superior.
* [pnpm](https://pnpm.io/) instalado globalmente (`npm install -g pnpm`).
* Una instancia activa de PostgreSQL.

---

## Inicio Rápido

1. **Instalar dependencias**:
   ```bash
   pnpm install
   ```

2. **Configurar variables de entorno**:
   Crea un archivo `.env` en la raíz del monorepo (y copia lo correspondiente a `apps/web/.env` y `packages/database/.env`):
   ```env
   DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/transcriber_db"
   JWT_SECRET="tu-secreto-super-seguro-aqui"
   
   # Clave para cifrar API keys en la BD (debe coincidir con la usada al guardarlas)
   # Si cambia, hay que volver a pegar las API keys en Administración.
   ENCRYPTION_KEY="default-encryption-key-123456789012"
   # Directorio donde se guardarán los audios temporalmente
   AUDIO_STORAGE_PATH="./storage/audio"
   ```

3. **Ejecutar migraciones de base de datos**:
   ```bash
   pnpm --filter database db:migrate
   ```

4. **Correr el proyecto en desarrollo**:
   ```bash
   pnpm dev
   ```
