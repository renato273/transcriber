/**
 * Reglas de contraseña compartidas (admin + registro).
 */
export function getPasswordChecks(password = '') {
  const value = String(password);
  return {
    minLength: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

export function isPasswordValid(password) {
  const checks = getPasswordChecks(password);
  return Object.values(checks).every(Boolean);
}

export const PASSWORD_RULES = [
  { key: 'minLength', label: 'Al menos 8 caracteres' },
  { key: 'uppercase', label: 'Al menos 1 mayúscula (A-Z)' },
  { key: 'lowercase', label: 'Al menos 1 minúscula (a-z)' },
  { key: 'special', label: 'Al menos 1 carácter especial (!@#$...)' },
];

export function passwordValidationError(password) {
  const checks = getPasswordChecks(password);
  const missing = PASSWORD_RULES.filter((r) => !checks[r.key]).map((r) => r.label);
  if (missing.length === 0) return null;
  return `La contraseña no cumple: ${missing.join('; ')}`;
}
