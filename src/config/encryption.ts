import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// Lazy-load encryption key to ensure dotenv has loaded
let cachedKey: Buffer | null = null;

const getEncryptionKey = (): Buffer => {
  if (cachedKey) {
    return cachedKey;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY || '';
  
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters. Please check your backend/.env file.');
  }

  cachedKey = crypto.scryptSync(encryptionKey, 'salt', 32);
  return cachedKey;
};

export const encrypt = (text: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

export const decrypt = (encryptedText: string): string => {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

