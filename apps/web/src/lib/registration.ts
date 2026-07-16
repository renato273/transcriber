import { prisma } from '@transcriber/database';

export const ALLOW_REGISTRATION_KEY = 'allow_registration';

/**
 * Registro abierto si:
 * - no hay usuarios (bootstrap del primer ADMIN), o
 * - el setting allow_registration === 'true'
 */
export async function isRegistrationOpen(): Promise<{
  open: boolean;
  needsBootstrap: boolean;
  usersCount: number;
}> {
  const usersCount = await prisma.user.count();
  const needsBootstrap = usersCount === 0;

  if (needsBootstrap) {
    return { open: true, needsBootstrap: true, usersCount };
  }

  const setting = await prisma.adminSetting.findUnique({
    where: { key: ALLOW_REGISTRATION_KEY },
  });

  return {
    open: setting?.value === 'true',
    needsBootstrap: false,
    usersCount,
  };
}

/** Tras crear el primer ADMIN, cierra el registro público. */
export async function closeRegistrationAfterBootstrap() {
  await prisma.adminSetting.upsert({
    where: { key: ALLOW_REGISTRATION_KEY },
    update: { value: 'false' },
    create: { key: ALLOW_REGISTRATION_KEY, value: 'false' },
  });
}
