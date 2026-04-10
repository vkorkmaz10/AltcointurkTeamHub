import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SEPARATOR = ":";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypts a plain text string using AES-256-GCM.
 * Returns a string in format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted].join(
    SEPARATOR
  );
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects input in format: iv:authTag:encryptedData
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(SEPARATOR);

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt an object of key-value pairs (for storing multiple API keys)
 */
export function encryptObject(
  obj: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value) {
      result[key] = encrypt(value);
    }
  }
  return result;
}

/**
 * Decrypt an object of key-value pairs
 */
export function decryptObject(
  obj: Record<string, string | null>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value) {
      result[key] = decrypt(value);
    }
  }
  return result;
}
