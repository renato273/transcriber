# Diseño de Base de Datos

Este documento define la estructura y el esquema de la base de datos PostgreSQL utilizando **Prisma ORM**. La base de datos almacena información sobre usuarios, sesiones activas, configuraciones de proveedores de IA, sesiones de transcripción, audios procesados y sus correspondientes traducciones.

---

## 1. Esquema de Prisma (`packages/database/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ----------------------------------------------------
// 1. USUARIOS Y AUTENTICACIÓN
// ----------------------------------------------------

enum Role {
  USER
  ADMIN
}

model User {
  id                    String                 @id @default(uuid())
  email                 String                 @unique
  passwordHash          String
  role                  Role                   @default(USER)
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt
  
  // Relaciones
  sessions              Session[]
  transcriptionSessions TranscriptionSession[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ----------------------------------------------------
// 2. CONFIGURACIÓN DE PROVEEDORES DE IA (ADMIN)
// ----------------------------------------------------

enum ProviderType {
  GOOGLE
  NVIDIA
  OPENROUTER
}

model AIProvider {
  id                     String       @id @default(uuid())
  type                   ProviderType @unique
  name                   String       // Nombre amigable (ej: "Google Gemini Free")
  apiKey                 String       // Guardada de forma encriptada
  baseUrl                String?      // Opcional para OpenRouter o NVIDIA custom endpoints
  isActive               Boolean      @default(false)
  isDefaultTranscription Boolean      @default(false)
  isDefaultTranslation   Boolean      @default(false)
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt
}

model AdminSetting {
  key       String   @id // Ej: "audio_retention_days", "max_upload_size_mb"
  value     String
  updatedAt DateTime @updatedAt
}

// ----------------------------------------------------
// 3. SESIONES Y DETALLES DE TRANSCRIPCIÓN
// ----------------------------------------------------

model TranscriptionSession {
  id             String          @id @default(uuid())
  userId         String
  title          String          // Nombre descriptivo (ej: "Clase de Programación 1")
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  // Relaciones
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  transcriptions Transcription[]

  @@index([userId])
}

enum TranscriptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Transcription {
  id           String              @id @default(uuid())
  sessionId    String
  audioPath    String?             // Ruta local del archivo (ej: "/storage/audio/xxxx.webm")
  status       TranscriptionStatus @default(PENDING)
  originalText String?             @db.Text
  language     String              @default("es") // Idioma detectado u original (ej: "es", "en")
  duration     Float?              // Duración del audio en segundos
  errorMessage String?             // Registro en caso de fallo
  providerUsed ProviderType?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  // Relaciones
  session      TranscriptionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  translations Translation[]

  @@index([sessionId])
}

model Translation {
  id              String        @id @default(uuid())
  transcriptionId String
  targetLanguage  String        // Idioma destino (ej: "en", "pt", "fr")
  translatedText  String        @db.Text
  providerUsed    ProviderType
  createdAt       DateTime      @default(now())

  // Relaciones
  transcription   Transcription @relation(fields: [transcriptionId], references: [id], onDelete: Cascade)

  @@index([transcriptionId])
}
```

---

## 2. Descripción de las Entidades

### `User` & `Session`
Estructura típica para soportar autenticación basada en base de datos.
* `role`: Define si el usuario es `ADMIN` (puede configurar las API Keys de los proveedores y límites del sistema) o `USER`.
* `Session`: Mapea tokens de sesión activos para el inicio de sesión. Compatible con frameworks como Lucia o sistemas de sesión JWT firmados guardados en cookies.

### `AIProvider`
Almacena las credenciales de las APIs de IA.
* **Seguridad**: El campo `apiKey` debe ser encriptado simétricamente (usando `crypto` de Node.js con un secreto de entorno `ENCRYPTION_KEY`) antes de guardarse en la base de datos para evitar fugas si la base de datos se ve comprometida.
* `isDefaultTranscription` e `isDefaultTranslation`: Permite al administrador definir qué IA gratuita se usará por defecto para cada proceso.

### `AdminSetting`
Colección clave-valor para configuraciones globales editables desde el panel de administración.
* Ejemplo: `audio_retention_days` = `"7"`. El script de limpieza leerá este valor para saber cuándo purgar el disco local de archivos de audio.

### `TranscriptionSession`
Agrupa un conjunto de audios de un usuario específico. Por ejemplo, una sesión puede llamarse "Entrevistas de Trabajo" y contener múltiples grabaciones.

### `Transcription`
Guarda el estado y el texto resultante de transcribir un archivo de audio.
* `audioPath`: Si el archivo de audio es eliminado por la política de retención del servidor, este campo puede pasar a ser `null` o el script de limpieza puede mantener el registro de base de datos intacto y simplemente vaciar el archivo en disco, marcando que el audio ya no está disponible para descarga pero la transcripción original sí.

### `Translation`
Permite tener múltiples traducciones asociadas a una única transcripción. Se procesa a partir del `originalText` ya guardado, ahorrando costos de llamadas de audio y procesando solo texto (que es mucho más barato/rápido).

---

## 3. Índices y Optimización

Se declaran índices explícitos (`@@index`) en campos clave para acelerar las consultas:
* `Session(userId)`: Optimiza la validación de peticiones entrantes.
* `TranscriptionSession(userId)`: Acelera la carga del panel principal del usuario.
* `Transcription(sessionId)`: Carga de manera eficiente todas las grabaciones de una sesión específica.
* `Translation(transcriptionId)`: Carga las traducciones disponibles al ver una transcripción.
