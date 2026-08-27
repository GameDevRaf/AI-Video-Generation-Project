import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ENCRYPTION_SECRET_ENV = 'API_KEY_ENCRYPTION_SECRET'

function encryptionSecret(): string {
  const secret = process.env[ENCRYPTION_SECRET_ENV]?.trim()
  if (!secret) {
    throw new Error(`${ENCRYPTION_SECRET_ENV} must be set to encrypt provider API keys`)
  }
  if (secret.length < 32) {
    throw new Error(`${ENCRYPTION_SECRET_ENV} must be at least 32 characters long`)
  }
  return secret
}

// Derives a stable 32-byte AES key from a dedicated application secret.
function derivedKey(): Buffer {
  return createHash('sha256').update(encryptionSecret()).digest()
}

export function encrypt(plaintext: string): string {
  const key = derivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':') as [string, string, string]
  const key = derivedKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
