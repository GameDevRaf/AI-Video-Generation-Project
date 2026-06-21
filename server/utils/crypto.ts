import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Derives a stable 32-byte AES key from the Supabase service role key
function derivedKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-fallback-secret'
  return createHash('sha256').update(secret).digest()
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
  const [ivHex, tagHex, ctHex] = stored.split(':')
  const key = derivedKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
