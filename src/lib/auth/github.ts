import { storage } from '../storage'
import { GitHubConfig } from '../types'

export class GitHubAuth {
  private baseURL = 'https://api.github.com'

  /**
   * Helper function to make GitHub API requests with proper headers
   */
  private async ghFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'LeetShip (+webextension)',
      ...init.headers,
    }

    return fetch(`${this.baseURL}${url}`, {
      ...init,
      headers,
    })
  }

  /**
   * Assert that the token is accepted by GitHub
   */
  async assertTokenAccepted(token: string): Promise<void> {
    const response = await this.ghFetch('/rate_limit', token)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token validation failed (${response.status}): ${errorText}`)
    }
  }

  /**
   * Try to get user info, tolerating 403 errors for fine-grained tokens
   */
  async tryGetUserInfo(token: string): Promise<any | undefined> {
    try {
      const response = await this.ghFetch('/user', token)

      if (response.status === 403) {
        return undefined
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get user info (${response.status}): ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting user info:', error)
      return undefined
    }
  }

  async authenticateWithToken(token: string): Promise<GitHubConfig> {
    try {
      // Validate the token by checking rate limit
      await this.assertTokenAccepted(token)
      // Try to get user info (best effort)
      const userInfo = await this.tryGetUserInfo(token)

      const config: GitHubConfig = {
        username: userInfo?.login || '',
        repository: '',
        branch: 'main',
        accessToken: token,
        refreshToken: '', // PATs don't have refresh tokens
        tokenExpiry: undefined, // PATs don't expire unless revoked
      }
      return config
    } catch (error) {
      console.error('💥 Personal Access Token authentication failed:', error)
      throw error
    }
  }

  async validateToken(
    accessToken: string
  ): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      // Use rate limit endpoint for validation (no extra scopes required)
      const response = await this.ghFetch('/rate_limit', accessToken)

      if (!response.ok) {
        let errorMessage = 'Token validation failed'

        if (response.status === 401) {
          errorMessage = 'Token is invalid or expired'
        } else if (response.status === 403) {
          errorMessage = 'Token lacks required permissions'
        } else if (response.status === 422) {
          errorMessage = 'Token format is invalid'
        }

        return { valid: false, error: errorMessage }
      }

      // Try to get user info as well
      const userInfo = await this.tryGetUserInfo(accessToken)
      return { valid: true, user: userInfo }
    } catch (error) {
      console.error('Token validation failed:', error)
      return { valid: false, error: 'Network error during token validation' }
    }
  }

  async validateStoredToken(): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      const config = await storage.getDecryptedConfig()

      if (!config.github?.accessToken) {
        return { valid: false, error: 'No stored token found' }
      }

      return await this.validateToken(config.github.accessToken)
    } catch (error) {
      console.error('Failed to validate stored token:', error)
      return { valid: false, error: 'Failed to access stored token' }
    }
  }

  async clearInvalidToken(): Promise<void> {
    try {
      const config = await storage.getDecryptedConfig()

      if (config.github) {
        config.github.accessToken = ''
        config.github.refreshToken = ''
        config.github.username = ''
        config.github.repository = ''
        config.github.branch = ''
        config.github.tokenExpiry = undefined

        await storage.setConfig(config)
      }
    } catch (error) {
      console.error('Failed to clear invalid token:', error)
      throw error
    }
  }

  async requireReAuthentication(): Promise<void> {
    await this.clearInvalidToken()
    // Notify user that re-authentication is required
    throw new Error(
      'Token has expired or is invalid. Please re-authenticate by going to the extension options page.'
    )
  }

  async getTokenHelpUrl(): Promise<string> {
    return 'https://github.com/settings/tokens/new'
  }

  async getTokenInstructions(): Promise<string> {
    return `
To create a new GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Set Note to "LeetShip Extension"
4. Select scopes:
   - repo (Full control of private repositories)
   - workflow (Update GitHub Action workflows)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again)
7. Use this token in the extension

For fine-grained tokens:
- Set "Contents" to "Read and write"
- Set "Metadata" to "Read-only"
    `.trim()
  }

  async signOut(): Promise<void> {
    try {
      await storage.clearAll()
    } catch (error) {
      console.error('Sign out failed:', error)
      throw error
    }
  }
}
