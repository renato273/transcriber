import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

const prisma = new PrismaClient();

async function cleanExpiredAudio() {
  console.log("=== Iniciando Limpieza de Archivos de Audio ===");

  // 1. Obtener la retención configurada (por defecto 7 días si no está definida)
  let days = 7;
  try {
    const retentionConfig = await prisma.adminSetting.findFirst({
      where: { key: 'audio_retention_days' }
    });
    if (retentionConfig && retentionConfig.value) {
      days = parseInt(retentionConfig.value);
    }
  } catch (error) {
    console.warn("No se pudo leer la configuración 'audio_retention_days' de la BD. Usando valor por defecto de 7 días.", error.message);
  }

  const expirationThreshold = new Date();
  expirationThreshold.setDate(expirationThreshold.getDate() - days);

  console.log(`Límite de retención: ${days} días.`);
  console.log(`Buscando archivos de audio modificados antes del: ${expirationThreshold.toISOString()}`);

  const storageDir = process.env.AUDIO_STORAGE_PATH || './storage/audio';

  if (!fs.existsSync(storageDir)) {
    console.log(`El directorio de almacenamiento '${storageDir}' no existe. Nada que limpiar.`);
    return;
  }

  // 2. Leer el directorio de almacenamiento
  fs.readdir(storageDir, (err, files) => {
    if (err) {
      console.error("Error leyendo directorio de audios:", err);
      return;
    }

    let deletedCount = 0;

    files.forEach(file => {
      // Ignore hidden files like .gitkeep or .DS_Store
      if (file.startsWith('.')) return;

      const filePath = path.join(storageDir, file);
      
      // Obtener estadísticas del archivo
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error obteniendo stats del archivo ${file}:`, err);
          return;
        }

        // Si el archivo es más viejo que el límite de retención
        if (stats.mtime < expirationThreshold) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Error al eliminar archivo ${file}:`, err);
            } else {
              console.log(`Archivo eliminado: ${file} (Modificado: ${stats.mtime.toISOString()})`);
              deletedCount++;
            }
          });
        }
      });
    });
  });
}

cleanExpiredAudio()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
