/**
 * Cookies de sesión.
 * En HTTP (LAN / IP local) NO usar Secure: el navegador las descarta.
 * En HTTPS de producción: COOKIE_SECURE=true o detección por protocolo.
 */
export function sessionCookieOptions(request: Request, expiresAt?: Date) {
  const explicit = process.env.COOKIE_SECURE;
  let secure = false;

  if (explicit === 'true') {
    secure = true;
  } else if (explicit === 'false') {
    secure = false;
  } else {
    try {
      secure = new URL(request.url).protocol === 'https:';
    } catch {
      secure = false;
    }
  }

  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
