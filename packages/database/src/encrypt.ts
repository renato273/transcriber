import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the provided secret using SHA-256.
 */
function getEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns the result in the format: iv.authTag.encryptedText (hex encoded)
 */
export function encrypt(text: string, secret: string): string {
  if (!secret) {
    throw new Error('Encryption secret key is required.');
  }

  const key = getEncryptionKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
}

/**
 * Decrypts a hex string (iv.authTag.encryptedText) using AES-256-GCM.
 */
export function decrypt(encryptedTextWithIv: string, secret: string): string {
  if (!secret) {
    throw new Error('Decryption secret key is required.');
  }

  const parts = encryptedTextWithIv.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected iv.authTag.encryptedText');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
