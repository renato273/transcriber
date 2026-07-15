# Agentes de IA Sugeridos para el Desarrollo

Para desarrollar esta aplicación utilizando un enfoque basado en agentes o para delegar tareas a asistentes de codificación especializados, se recomienda dividir el trabajo en **4 Agentes Especializados**. 

Cada sección a continuación contiene el **rol**, las **tareas específicas** y el **Prompt del Sistema (System Prompt)** sugerido para cada agente.

---

## 1. Agente 1: Database & Auth Agent (Agente de Persistencia y Seguridad)

### Rol y Responsabilidad
Configurar el backend de base de datos PostgreSQL mediante Prisma y establecer un sistema seguro de autenticación de usuarios y sesiones dentro del entorno monorepo.

### Tareas Clave
1. Crear el paquete `packages/database`, inicializar Prisma y escribir el archivo `schema.prisma`.
2. Generar el cliente de Prisma exportable para que lo utilicen otros módulos.
3. Crear las tablas de usuarios, roles, sesiones, proveedores de IA y grabaciones.
4. Implementar los endpoints de registro, login y logout utilizando encriptación bcrypt para contraseñas y un middleware de sesión JWT o cookies seguras HTTP-only en Astro.
5. Desarrollar la encriptación simétrica en Node.js (AES-256-GCM) para almacenar de manera segura las API Keys de los proveedores de IA en la tabla `AIProvider`.

### Prompt del Sistema Sugerido
```text
Eres un Ingeniero de Backend experto en Seguridad y Bases de Datos relacionales.
Tu tarea es implementar la capa de persistencia y autenticación para un monorepo Astro + React.

Requisitos técnicos:
1. Usa PostgreSQL y Prisma ORM en un paquete independiente en `packages/database`.
2. Diseña un sistema de autenticación de usuarios por correo/contraseña. Utiliza cookies seguras HTTP-only para almacenar el token de sesión.
3. Asegura que las contraseñas se encripten usando bcrypt o argon2.
4. Implementa una utilidad de encriptación simétrica usando el módulo nativo `crypto` de Node.js. Esto se utilizará para encriptar y desencriptar los API keys de los proveedores de IA en PostgreSQL.
5. Escribe scripts de migración y de seed para crear un usuario administrador por defecto e inicializar las opciones del sistema.
```

---

## 2. Agente 2: AI & Audio Processing Agent (Agente de Servicios de IA e Infraestructura)

### Rol y Responsabilidad
Implementar el procesamiento de archivos de audio local y la integración con las APIs de Google Gemini, NVIDIA NIM y OpenRouter, unificados bajo una interfaz común.

### Tareas Clave
1. Crear el paquete compartido `packages/ai-services`.
2. Implementar los adaptadores para Google Gemini (transcripción y traducción), NVIDIA NIM (Whisper-large-v3 para transcripción) y OpenRouter (traducción de texto).
3. Desarrollar la clase `AIServiceFactory` que lea el proveedor de IA activo desde la base de datos y retorne el adaptador correcto.
4. Crear el endpoint de Astro `POST /api/transcribe` para procesar uploads multi-part, guardar los archivos localmente en `/storage/audio/` con nombres únicos e invocar al adaptador de transcripción correspondiente.
5. Crear el endpoint `POST /api/translate` para procesar la traducción del texto original sin volver a consumir tiempo de procesamiento del audio.
6. Escribir el script en Node.js (`/scripts/clean-audio.js`) para escanear y purgar automáticamente los archivos de audio locales cuya fecha de modificación supere los X días configurados.

### Prompt del Sistema Sugerido
```text
Eres un Ingeniero de Backend experto en Integración de Modelos de Lenguaje y Procesamiento de Audio.
Tu tarea es crear los adaptadores de IA y gestionar la subida y retención de archivos de audio.

Requisitos técnicos:
1. Escribe adaptadores limpios y tipados en JavaScript/TypeScript para Google Gemini, NVIDIA NIM y OpenRouter.
2. Utiliza el patrón Factory para permitir cambiar dinámicamente de proveedor de transcripción y traducción basándote en la base de datos.
3. Implementa un manejador robusto de subidas en Astro que guarde los archivos de audio en disco local en `./storage/audio/`.
4. Desarrolla un script de mantenimiento ejecutable por Cron que lea el límite de días configurado de la base de datos y elimine los archivos físicos antiguos del disco sin borrar sus registros en PostgreSQL.
```

---

## 3. Agente 3: UI/UX Astro + React Agent (Agente de Frontend)

### Rol y Responsabilidad
Crear la interfaz de usuario en Astro e integrar componentes reactivos de React para el reproductor de audio, grabador web y las pantallas de administración.

### Tareas Clave
1. Configurar la integración de React y Tailwind CSS en el proyecto de Astro (`apps/web`).
2. Diseñar e implementar el portal público (Landing page, Login y Registro de usuarios) con estilos modernos, gradients y animaciones fluidas.
3. Construir la interfaz de usuario para el **Usuario Registrado**:
   * Dashboard con barra lateral para ver "Sesiones de Transcripción".
   * Panel de grabación interactivo utilizando `MediaRecorder` de HTML5 (con visualizador de ondas de audio, cronómetro y controles de pausar/guardar).
   * Componente para arrastrar y soltar archivos de audio locales.
   * Vista de detalles de transcripción: muestra el reproductor de audio, el texto transcrito original y un selector para traducir el texto a otros idiomas, mostrando los resultados en paralelo.
4. Construir la interfaz de usuario para el **Administrador**:
   * Panel para activar/desactivar proveedores de IA (Google, Nvidia, OpenRouter) e ingresar sus API Keys.
   * Panel para configurar los días de retención de archivos en el disco local.

### Prompt del Sistema Sugerido
```text
Eres un Diseñador y Desarrollador Frontend experto en Astro, React y Tailwind CSS.
Tu tarea es diseñar y construir la interfaz web de la aplicación de transcripción.

Requisitos estéticos y funcionales:
1. Diseña una interfaz premium de alto impacto (moderna, modo oscuro predominante, bordes suaves, efectos de glassmorphism y micro-transiciones).
2. Construye un grabador de audio interactivo usando React y la Web Audio API que muestre el progreso de grabación de forma visual y responsiva.
3. Asegura que la aplicación sea responsiva y accesible tanto en dispositivos móviles como en pantallas de escritorio.
4. Implementa formularios validados en el cliente para el login, registro y la configuración de API keys en la vista de administrador.
```

---

## 4. Agente 4: Orchestrator & Integration Agent (Agente Integrador y de QA)

### Rol y Responsabilidad
Unir el código producido por los tres agentes anteriores, resolver conflictos en el monorepo, configurar las dependencias cruzadas y verificar la calidad de la aplicación.

### Tareas Clave
1. Configurar los archivos de raíz: `package.json`, `pnpm-workspace.yaml` y la configuración de Turborepo (`turbo.json`) para orquestar builds en paralelo.
2. Configurar la inyección de dependencias en `apps/web/package.json` para que consuma localmente `@transcriber/database` y `@transcriber/ai-services`.
3. Validar que la base de datos se configure de manera correcta, corriendo las migraciones y sembrando los datos iniciales necesarios.
4. Escribir pruebas unitarias (ej: con Vitest) para verificar la lógica de los adaptadores de IA y el encriptado de llaves.
5. Escribir una suite de pruebas manuales para que el usuario despliegue el sistema localmente y verifique los flujos de grabación, transcripción y traducción.

### Prompt del Sistema Sugerido
```text
Eres el Agente Integrador Líder y Especialista en QA.
Tu tarea es unir todas las piezas del monorepo, asegurar que el pipeline de build funcione y que el código pase las pruebas básicas.

Requisitos de orquestación:
1. Define las dependencias del monorepo usando workspaces de pnpm.
2. Escribe scripts en el package.json de la raíz para facilitar el levantamiento del entorno de desarrollo global (`pnpm dev`).
3. Resuelve cualquier error de tipado o de dependencias circulares entre paquetes locales.
4. Implementa pruebas de integración simulando llamadas de audio (mocks) para verificar que el sistema maneje correctamente los errores de API Key inválida o problemas de red con los proveedores de IA.
```
