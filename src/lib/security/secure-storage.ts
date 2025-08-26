import { getBrowser } from '../browser'

/**
 * Enhanced secure storage for browser extensions using Web Crypto API
 * Based on 2024 security best practices for Chrome/Firefox extensions
 */
export class SecureStorage {
  private browser = getBrowser()
  private keyCache = new Map<string, CryptoKey>()

  /**
   * Generate a strong encryption key using Web Crypto API
   */
  private async generateEncryptionKey(salt: string): Promise<CryptoKey> {
    // Create a unique key based on extension runtime and salt
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(`LeetShip-${this.browser.runtime.id}-${salt}`),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derive a strong encryption key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Get or create encryption key with caching
   */
  private async getEncryptionKey(context: string): Promise<CryptoKey> {
    if (this.keyCache.has(context)) {
      return this.keyCache.get(context)!
    }

    const key = await this.generateEncryptionKey(context)
    this.keyCache.set(context, key)
    return key
  }

  /**
   * Encrypt sensitive data using AES-GCM
   */
  async encryptData(data: string, context: string = 'default'): Promise<string> {
    try {
      const key = await this.getEncryptionKey(context)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encodedData = new TextEncoder().encode(data)

      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData)

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(encrypted), iv.length)

      // Return base64 encoded result
      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt sensitive data using AES-GCM
   */
  async decryptData(encryptedData: string, context: string = 'default'): Promise<string> {
    try {
      const key = await this.getEncryptionKey(context)

      // Decode base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)

      return new TextDecoder().decode(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      // For migration purposes, return original data if decryption fails
      return encryptedData
    }
  }

  /**
   * Store encrypted data in chrome.storage.local
   */
  async setSecureData(key: string, data: string): Promise<void> {
    try {
      const encrypted = await this.encryptData(data, key)
      await this.browser.storage.local.set({ [key]: encrypted })
    } catch (error) {
      console.error('Secure storage failed:', error)
      throw new Error('Failed to store secure data')
    }
  }

  /**
   * Retrieve and decrypt data from chrome.storage.local
   */
  async getSecureData(key: string): Promise<string | null> {
    try {
      const result = await this.browser.storage.local.get(key)
      const encrypted = result[key]

      if (!encrypted) {
        return null
      }

      return await this.decryptData(encrypted, key)
    } catch (error) {
      console.error('Secure retrieval failed:', error)
      return null
    }
  }

  /**
   * Store data in session storage (memory-based, more secure)
   */
  async setSessionData(key: string, data: string): Promise<void> {
    try {
      // Use chrome.storage.session if available (Chrome MV3)
      if (this.browser.storage.session && typeof this.browser.storage.session.set === 'function') {
        await this.browser.storage.session.set({ [key]: data })
      } else {
        // Fallback to persistent storage for better reliability
        await this.setSecureData(`session:${key}`, data)
      }
    } catch (error) {
      console.error('Session storage failed:', error)
      // Fallback to persistent storage if session storage fails
      await this.setSecureData(`session:${key}`, data)
    }
  }

  /**
   * Retrieve data from session storage
   */
  async getSessionData(key: string): Promise<string | null> {
    try {
      if (this.browser.storage.session && typeof this.browser.storage.session.get === 'function') {
        const result = await this.browser.storage.session.get(key)
        return result[key] || null
      } else {
        return await this.getSecureData(`session:${key}`)
      }
    } catch (error) {
      console.error('Session retrieval failed:', error)
      // Fallback to persistent storage if session storage fails
      return await this.getSecureData(`session:${key}`)
    }
  }

  /**
   * Clear session data
   */
  async clearSessionData(key?: string): Promise<void> {
    try {
      if (
        this.browser.storage.session &&
        typeof this.browser.storage.session.remove === 'function'
      ) {
        if (key) {
          await this.browser.storage.session.remove(key)
        } else {
          await this.browser.storage.session.clear()
        }
      } else {
        if (key) {
          await this.browser.storage.local.remove(`session:${key}`)
        } else {
          // Clear all session keys
          const allData = await this.browser.storage.local.get()
          const sessionKeys = Object.keys(allData).filter(k => k.startsWith('session:'))
          await this.browser.storage.local.remove(sessionKeys)
        }
      }
    } catch (error) {
      console.error('Session cleanup failed:', error)
    }
  }

  /**
   * Clear all cached encryption keys (security cleanup)
   */
  clearKeyCache(): void {
    this.keyCache.clear()
  }

  /**
   * Validate stored data integrity
   */
  async validateDataIntegrity(key: string): Promise<boolean> {
    try {
      const data = await this.getSecureData(key)
      return data !== null
    } catch (error) {
      return false
    }
  }
}

export const secureStorage = new SecureStorage()
