import { getBrowser } from '../browser'
import { ExtensionConfig, QueuedCommit } from '../types'
import CryptoJS from 'crypto-js'
import { tokenManager } from '../security/token-manager'

const STORAGE_KEYS = {
  CONFIG: 'LeetShip:config',
  QUEUE: 'LeetShip:queue',
  AUTH_STATE: 'LeetShip:auth_state',
  PROCESSED_SUBMISSIONS: 'LeetShip:processed',
} as const

const DEFAULT_CONFIG: ExtensionConfig = {
  github: null,
  templates: {
    commitMessage:
      'feat(leetcode): AC {{id}}. {{title}} [{{difficulty}}] ({{lang}}) — runtime: {{runtime}}, memory: {{memory}}',
    readme: `# {{title}}

[LeetCode Problem]({{link}})

**Difficulty:** {{difficulty}}
**Tags:** {{tags}}
**Language:** {{lang}}
**Runtime:** {{runtime}}
**Memory:** {{memory}}
**Submitted:** {{timestamp}}
`,
    folderLayout: '{{difficulty}}/{{id}}-{{slug}}',
  },
  settings: {
    includeProblemStatement: false,
    sanitizeFilenames: true,
    skipDuplicates: true,
    autoRetry: true,
    privateRepoWarning: true,
    telemetry: false,
  },
  version: 1,
}

// Legacy encryption for migration purposes
const ENCRYPTION_KEY = `LeetShip-${getBrowser().runtime.id || 'default'}-${navigator.userAgent.slice(-20)}`

function decrypt(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)

    // Validate that the decrypted data is valid
    if (!decrypted || decrypted.trim() === '') {
      throw new Error('Decrypted data is empty')
    }

    return decrypted
  } catch (error) {
    // If decryption fails, assume it's already plain text (for migration)
    return encryptedData
  }
}

export class StorageManager {
  private browser = getBrowser()

  async getConfig(): Promise<ExtensionConfig> {
    try {
      const result = await this.browser.storage.local.get(STORAGE_KEYS.CONFIG)
      const stored = result && result[STORAGE_KEYS.CONFIG]

      if (!stored) {
        await this.setConfig(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
      }

      return { ...DEFAULT_CONFIG, ...stored }
    } catch (error) {
      console.error('Failed to get config:', error)
      return DEFAULT_CONFIG
    }
  }

  async setConfig(config: ExtensionConfig): Promise<void> {
    try {
      // Store GitHub config using secure token manager
      if (config.github) {
        await tokenManager.storeGitHubToken(config.github)
      }

      // Store non-sensitive config data
      const configToStore = { ...config }
      if (configToStore.github) {
        // Remove sensitive data before storing
        configToStore.github = {
          ...configToStore.github,
          accessToken: '',
          refreshToken: ''
        }
      }

      await this.browser.storage.local.set({
        [STORAGE_KEYS.CONFIG]: configToStore,
      })
    } catch (error) {
      console.error('Failed to set config:', error)
      throw error
    }
  }

  async getDecryptedConfig(): Promise<ExtensionConfig> {
    const config = await this.getConfig()

    // Get GitHub config from secure token manager
    const githubConfig = await tokenManager.getGitHubConfig()
    if (githubConfig) {
      config.github = githubConfig
    } else if (config.github) {
      // Fallback: try legacy decryption for migration
      try {
        if (config.github.accessToken) {
          config.github.accessToken = decrypt(config.github.accessToken)
        }
        if (config.github.refreshToken) {
          config.github.refreshToken = decrypt(config.github.refreshToken)
        }
        
        // Migrate to new secure storage
        if (config.github.accessToken) {
          await tokenManager.storeGitHubToken(config.github)
          console.log('✅ Migrated tokens to secure storage')
        }
      } catch (error) {
        console.error('Failed to decrypt tokens (legacy):', error)
        // Clear corrupted data
        config.github.accessToken = ''
        config.github.refreshToken = ''
      }
    }

    return config
  }

  async clearCorruptedData(): Promise<void> {
    try {
      // Get current config and clear tokens
      const config = await this.getConfig()
      if (config.github) {
        config.github.accessToken = ''
        config.github.refreshToken = ''
        config.github.username = ''
        config.github.repository = ''
        config.github.branch = ''
        config.github.tokenExpiry = undefined
      }

      // Save the cleaned config
      await this.setConfig(config)

      // Clear other potentially corrupted data
      await this.browser.storage.local.remove([
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.AUTH_STATE,
        STORAGE_KEYS.PROCESSED_SUBMISSIONS,
      ])
    } catch (error) {
      console.error('Failed to clear corrupted data:', error)
      // If all else fails, clear everything
      await this.clearAll()
    }
  }

  async forceTokenRefresh(): Promise<void> {
    try {
      // Use secure token manager to clear tokens
      await tokenManager.forceTokenRefresh()
      
      // Also clear local config tokens (legacy cleanup)
      const config = await this.getConfig()
      if (config.github) {
        config.github.accessToken = ''
        config.github.refreshToken = ''
        config.github.tokenExpiry = undefined
        await this.browser.storage.local.set({
          [STORAGE_KEYS.CONFIG]: config,
        })
      }
    } catch (error) {
      console.error('Failed to force token refresh:', error)
      throw error
    }
  }

  async getCommitQueue(): Promise<QueuedCommit[]> {
    try {
      const result = await this.browser.storage.local.get(STORAGE_KEYS.QUEUE)
      return (result && result[STORAGE_KEYS.QUEUE]) || []
    } catch (error) {
      console.error('Failed to get commit queue:', error)
      return []
    }
  }

  async addToCommitQueue(commit: QueuedCommit): Promise<void> {
    try {
      const queue = await this.getCommitQueue()
      queue.push(commit)
      await this.browser.storage.local.set({
        [STORAGE_KEYS.QUEUE]: queue,
      })
    } catch (error) {
      console.error('Failed to add to commit queue:', error)
      throw error
    }
  }

  async removeFromCommitQueue(commitId: string): Promise<void> {
    try {
      const queue = await this.getCommitQueue()
      const filtered = queue.filter(commit => commit.id !== commitId)
      await this.browser.storage.local.set({
        [STORAGE_KEYS.QUEUE]: filtered,
      })
    } catch (error) {
      console.error('Failed to remove from commit queue:', error)
      throw error
    }
  }

  async updateCommitInQueue(commitId: string, updates: Partial<QueuedCommit>): Promise<void> {
    try {
      const queue = await this.getCommitQueue()
      const index = queue.findIndex(commit => commit.id === commitId)

      if (index !== -1) {
        queue[index] = { ...queue[index], ...updates }
        await this.browser.storage.local.set({
          [STORAGE_KEYS.QUEUE]: queue,
        })
      }
    } catch (error) {
      console.error('Failed to update commit in queue:', error)
      throw error
    }
  }

  async getProcessedSubmissions(): Promise<Set<string>> {
    try {
      const result = await this.browser.storage.local.get(STORAGE_KEYS.PROCESSED_SUBMISSIONS)
      const processed = (result && result[STORAGE_KEYS.PROCESSED_SUBMISSIONS]) || []
      return new Set(processed)
    } catch (error) {
      console.error('Failed to get processed submissions:', error)
      return new Set()
    }
  }

  async markSubmissionProcessed(submissionId: string): Promise<void> {
    try {
      const processed = await this.getProcessedSubmissions()
      processed.add(submissionId)
      await this.browser.storage.local.set({
        [STORAGE_KEYS.PROCESSED_SUBMISSIONS]: Array.from(processed),
      })
    } catch (error) {
      console.error('Failed to mark submission processed:', error)
      throw error
    }
  }

  async setAuthState(state: string): Promise<void> {
    try {
      await this.browser.storage.local.set({
        [STORAGE_KEYS.AUTH_STATE]: state,
      })
    } catch (error) {
      console.error('Failed to set auth state:', error)
      throw error
    }
  }

  async getAuthState(): Promise<string | null> {
    try {
      const result = await this.browser.storage.local.get(STORAGE_KEYS.AUTH_STATE)
      return (result && result[STORAGE_KEYS.AUTH_STATE]) || null
    } catch (error) {
      console.error('Failed to get auth state:', error)
      return null
    }
  }

  async clearAuthState(): Promise<void> {
    try {
      await this.browser.storage.local.remove(STORAGE_KEYS.AUTH_STATE)
    } catch (error) {
      console.error('Failed to clear auth state:', error)
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Clear secure token storage
      await tokenManager.clearAllTokens()
      
      // Clear regular storage
      await this.browser.storage.local.clear()
      
      // Clear session storage if available
      if (this.browser.storage.session) {
        await this.browser.storage.session.clear()
      }
    } catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }
}

export const storage = new StorageManager()
