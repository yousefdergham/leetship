import { secureStorage } from './secure-storage'
import { getBrowser } from '../browser'
import { GitHubConfig } from '../types'

/**
 * Secure token manager implementing best practices for OAuth token handling
 * in browser extensions. Based on 2024 security guidelines.
 */
export class TokenManager {
  private browser = getBrowser()
  private tokenValidationCache = new Map<string, { valid: boolean; expires: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  private readonly STORAGE_KEYS = {
    GITHUB_TOKEN: 'secure:github:access_token',
    GITHUB_REFRESH: 'secure:github:refresh_token',
    GITHUB_CONFIG: 'secure:github:config',
    TOKEN_METADATA: 'secure:token:metadata',
  }

  /**
   * Store GitHub token securely with metadata
   */
  async storeGitHubToken(config: GitHubConfig): Promise<void> {
    try {
      // Store access token in session storage (memory-based, more secure)
      if (config.accessToken) {
        await secureStorage.setSessionData(this.STORAGE_KEYS.GITHUB_TOKEN, config.accessToken)
      }

      // Store refresh token persistently (encrypted)
      if (config.refreshToken) {
        await secureStorage.setSecureData(this.STORAGE_KEYS.GITHUB_REFRESH, config.refreshToken)
      }

      // Store configuration (without tokens)
      const safeConfig = {
        ...config,
        accessToken: '', // Don't store in config
        refreshToken: '', // Don't store in config
      }
      await secureStorage.setSecureData(this.STORAGE_KEYS.GITHUB_CONFIG, JSON.stringify(safeConfig))

      // Store metadata for validation
      const metadata = {
        storedAt: Date.now(),
        tokenExpiry: config.tokenExpiry,
        lastValidated: Date.now(),
      }
      await secureStorage.setSecureData(this.STORAGE_KEYS.TOKEN_METADATA, JSON.stringify(metadata))

      console.log('✅ GitHub token stored securely')
    } catch (error) {
      console.error('❌ Failed to store GitHub token:', error)
      throw new Error('Failed to store GitHub token securely')
    }
  }

  /**
   * Retrieve GitHub token with automatic validation
   */
  async getGitHubToken(): Promise<string | null> {
    try {
      console.log('🔍 Attempting to retrieve GitHub token...')

      // First try session storage (fastest, most secure)
      let token = await secureStorage.getSessionData(this.STORAGE_KEYS.GITHUB_TOKEN)

      if (token) {
        console.log('🔍 Found token in session storage, validating...')
        // Validate token if we have it in session
        const isValid = await this.validateTokenWithCache(token)
        if (isValid) {
          console.log('✅ Token from session storage is valid')
          return token
        } else {
          console.warn('⚠️ Token from session storage is invalid, clearing...')
          // Token is invalid, clear session
          await secureStorage.clearSessionData(this.STORAGE_KEYS.GITHUB_TOKEN)
        }
      } else {
        console.log('🔍 No token found in session storage')
      }

      // Try to refresh from persistent storage
      console.log('🔍 Attempting to retrieve from persistent storage...')
      token = await this.refreshTokenFromStorage()
      if (token) {
        console.log('✅ Successfully retrieved token from persistent storage')
        // Store in session for future use (but don't fail if session storage is unavailable)
        try {
          await secureStorage.setSessionData(this.STORAGE_KEYS.GITHUB_TOKEN, token)
          console.log('✅ Token stored in session storage for future use')
        } catch (error) {
          console.warn(
            '⚠️ Failed to store token in session storage, but continuing with persistent storage:',
            error
          )
        }
        return token
      }

      console.log('❌ No valid token found in any storage')
      return null
    } catch (error) {
      console.error('❌ Failed to retrieve GitHub token:', error)
      return null
    }
  }

  /**
   * Get full GitHub configuration
   */
  async getGitHubConfig(): Promise<GitHubConfig | null> {
    try {
      const configData = await secureStorage.getSecureData(this.STORAGE_KEYS.GITHUB_CONFIG)
      if (!configData) {
        return null
      }

      const config: GitHubConfig = JSON.parse(configData)

      // Add tokens back from secure storage
      config.accessToken = (await this.getGitHubToken()) || ''
      config.refreshToken =
        (await secureStorage.getSecureData(this.STORAGE_KEYS.GITHUB_REFRESH)) || ''

      return config
    } catch (error) {
      console.error('❌ Failed to retrieve GitHub config:', error)
      return null
    }
  }

  /**
   * Validate token with caching to reduce API calls
   */
  private async validateTokenWithCache(token: string): Promise<boolean> {
    const tokenHash = await this.hashToken(token)
    const cached = this.tokenValidationCache.get(tokenHash)

    if (cached && Date.now() < cached.expires) {
      return cached.valid
    }

    // Validate with GitHub API
    const isValid = await this.validateTokenWithGitHub(token)

    // Cache result
    this.tokenValidationCache.set(tokenHash, {
      valid: isValid,
      expires: Date.now() + this.CACHE_DURATION,
    })

    return isValid
  }

  /**
   * Create a hash of the token for caching (security)
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Validate token with GitHub API
   */
  private async validateTokenWithGitHub(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'LeetShip (+webextension)',
        },
      })

      return response.ok
    } catch (error) {
      console.error('Token validation failed:', error)
      return false
    }
  }

  /**
   * Attempt to refresh token from persistent storage
   */
  private async refreshTokenFromStorage(): Promise<string | null> {
    try {
      // Check if we have metadata
      const metadataStr = await secureStorage.getSecureData(this.STORAGE_KEYS.TOKEN_METADATA)
      if (!metadataStr) {
        console.log('🔍 No token metadata found in persistent storage')
        return null
      }

      const metadata = JSON.parse(metadataStr)

      // Check if token should still be valid
      if (metadata.tokenExpiry && Date.now() > metadata.tokenExpiry) {
        console.warn('⚠️ Stored token has expired')
        await this.clearAllTokens()
        return null
      }

      // For PATs, try to get from refresh token storage (fallback)
      const refreshToken = await secureStorage.getSecureData(this.STORAGE_KEYS.GITHUB_REFRESH)
      if (refreshToken) {
        console.log('🔍 Found token in persistent storage, validating...')
        // For GitHub PATs, refresh token is the same as access token
        const isValid = await this.validateTokenWithGitHub(refreshToken)
        if (isValid) {
          console.log('✅ Token from persistent storage is valid')
          return refreshToken
        } else {
          console.warn('⚠️ Token from persistent storage is invalid')
        }
      } else {
        console.log('🔍 No token found in persistent storage')
      }

      return null
    } catch (error) {
      console.error('❌ Failed to refresh token from storage:', error)
      return null
    }
  }

  /**
   * Clear all stored tokens and related data
   */
  async clearAllTokens(): Promise<void> {
    try {
      // Clear session storage
      await secureStorage.clearSessionData(this.STORAGE_KEYS.GITHUB_TOKEN)

      // Clear persistent storage
      await Promise.all([
        this.browser.storage.local.remove(this.STORAGE_KEYS.GITHUB_REFRESH),
        this.browser.storage.local.remove(this.STORAGE_KEYS.GITHUB_CONFIG),
        this.browser.storage.local.remove(this.STORAGE_KEYS.TOKEN_METADATA),
      ])

      // Clear caches
      this.tokenValidationCache.clear()
      secureStorage.clearKeyCache()

      console.log('✅ All tokens cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error)
      throw new Error('Failed to clear tokens')
    }
  }

  /**
   * Check if user has valid authentication
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getGitHubToken()
    return token !== null && token.length > 0
  }

  /**
   * Get token metadata for debugging/monitoring
   */
  async getTokenMetadata(): Promise<any> {
    try {
      const metadataStr = await secureStorage.getSecureData(this.STORAGE_KEYS.TOKEN_METADATA)
      return metadataStr ? JSON.parse(metadataStr) : null
    } catch (error) {
      return null
    }
  }

  /**
   * Periodic cleanup of expired tokens and caches
   */
  async performSecurityCleanup(): Promise<void> {
    try {
      // Clear expired validation cache entries
      const now = Date.now()
      for (const [key, value] of this.tokenValidationCache.entries()) {
        if (now >= value.expires) {
          this.tokenValidationCache.delete(key)
        }
      }

      // Check if stored token is expired
      const metadata = await this.getTokenMetadata()
      if (metadata?.tokenExpiry && now > metadata.tokenExpiry) {
        console.warn('⚠️ Performing security cleanup: token expired')
        await this.clearAllTokens()
      }

      // Clear encryption key cache periodically
      secureStorage.clearKeyCache()
    } catch (error) {
      console.error('❌ Security cleanup failed:', error)
    }
  }

  /**
   * Force token refresh by clearing session storage
   */
  async forceTokenRefresh(): Promise<void> {
    await secureStorage.clearSessionData(this.STORAGE_KEYS.GITHUB_TOKEN)
    this.tokenValidationCache.clear()
  }
}

export const tokenManager = new TokenManager()
