import { getBrowser } from '../lib/browser'
import { storage } from '../lib/storage'
import { LeetCodeSubmission, QueuedCommit } from '../lib/types'
import { CommitManager } from './commit-manager'
import { GitHubAuth } from '../lib/auth/github'
import { tokenManager } from '../lib/security/token-manager'

class LeetShipBackgroundService {
  private browser = getBrowser()
  private commitManager = new CommitManager()
  private githubAuth = new GitHubAuth()
  private processing = new Set<string>()

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    this.browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true
    })

    this.browser.runtime.onInstalled.addListener(async details => {
      if (details.reason === 'install') {
        await this.handleFirstInstall()
      }
    })

    // Start background processes
    setTimeout(() => this.processQueuedCommits(), 2000)
    
    // Start periodic security maintenance
    this.startSecurityMaintenance()
  }

  private async handleMessage(
    message: any,
    _sender: any,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'SUBMISSION_ACCEPTED':
          await this.handleSubmissionAccepted(message.submission)
          sendResponse({ success: true })
          break

        case 'GET_STATUS':
          const status = await this.getExtensionStatus()
          sendResponse(status)
          break

        case 'TEST_CONNECTION':
          const testResult = await this.testGitHubConnection()
          sendResponse(testResult)
          break

        case 'AUTH_WITH_PAT':
          const authResult = await this.handleAuthWithPAT(message.payload)
          sendResponse(authResult)
          break

        default:
          sendResponse({ error: 'Unknown message type' })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      sendResponse({ error: errorMessage })
      this.showErrorNotification('Processing failed', errorMessage)
    }
  }

  private async handleSubmissionAccepted(submissionData: LeetCodeSubmission): Promise<void> {
    const processingKey = `${submissionData.titleSlug}-${submissionData.language}-${Date.now()}`
    
    if (this.processing.has(processingKey)) {
      return
    }

    this.processing.add(processingKey)

    try {
      // Enhanced authentication validation
      const isAuthenticated = await this.validateAuthentication()
      if (!isAuthenticated) {
        return
      }

      const config = await storage.getDecryptedConfig()

      if (!this.isValidSubmission(submissionData)) {
        throw new Error('Invalid submission data')
      }

      if (config.settings?.skipDuplicates && await this.isDuplicateSubmission(submissionData)) {
        return
      }

      await this.processSubmissionImmediately(submissionData)
      await this.markSubmissionProcessed(submissionData)
      this.showSuccessNotification(submissionData)

    } catch (error) {
      // Check if error is due to authentication issues
      if (error instanceof Error && (error.message.includes('Bad credentials') || error.message.includes('401'))) {
        await this.handleInvalidToken(error.message)
        return
      }
      
      await this.queueSubmissionForRetry(submissionData, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.showErrorNotification('Commit failed', errorMessage)
      
    } finally {
      this.processing.delete(processingKey)
    }
  }

  private async processSubmissionImmediately(submission: LeetCodeSubmission): Promise<void> {
    const queuedCommit: QueuedCommit = {
      id: `immediate-${Date.now()}`,
      submission,
      timestamp: Date.now(),
      retryCount: 0
    }

    await this.commitManager.processCommit(queuedCommit)
  }

  private async queueSubmissionForRetry(submission: LeetCodeSubmission, error: any): Promise<void> {
    const queuedCommit: QueuedCommit = {
      id: `retry-${Date.now()}`,
      submission,
      timestamp: Date.now(),
      retryCount: 0,
      lastError: error instanceof Error ? error.message : 'Unknown error'
    }

    await storage.addToCommitQueue(queuedCommit)
  }

  private async processQueuedCommits(): Promise<void> {
    try {
      const queue = await storage.getCommitQueue()
      
      // Check authentication before processing queue
      const isAuthenticated = await this.validateAuthentication()
      if (!isAuthenticated) {
        return
      }

      for (const queuedCommit of queue) {
        if (this.processing.has(queuedCommit.id)) {
          continue
        }

        if (queuedCommit.retryCount >= 3) {
          await storage.removeFromCommitQueue(queuedCommit.id)
          continue
        }

        this.processing.add(queuedCommit.id)

        try {
          await this.commitManager.processCommit(queuedCommit)
          await storage.removeFromCommitQueue(queuedCommit.id)
          await this.markSubmissionProcessed(queuedCommit.submission)

        } catch (error) {
          await storage.updateCommitInQueue(queuedCommit.id, {
            retryCount: queuedCommit.retryCount + 1,
            lastError: error instanceof Error ? error.message : 'Unknown error'
          })
          
        } finally {
          this.processing.delete(queuedCommit.id)
        }

        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      // Silent fail for queue processing
    }
  }

  private isValidSubmission(submission: LeetCodeSubmission): boolean {
    const required = ['title', 'titleSlug', 'code', 'language']
    return required.every(field => submission[field as keyof LeetCodeSubmission])
  }

  private async isDuplicateSubmission(submission: LeetCodeSubmission): Promise<boolean> {
    const processed = await storage.getProcessedSubmissions()
    const key = this.generateSubmissionKey(submission)
    return processed.has(key)
  }

  private generateSubmissionKey(submission: LeetCodeSubmission): string {
    const codeLength = submission.code.length
    const codeHash = this.simpleHash(submission.code)
    return `${submission.titleSlug}-${submission.language}-${codeLength}-${codeHash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff
    }
    return Math.abs(hash).toString(36)
  }

  private async markSubmissionProcessed(submission: LeetCodeSubmission): Promise<void> {
    const key = this.generateSubmissionKey(submission)
    await storage.markSubmissionProcessed(key)
  }

  private async getExtensionStatus() {
    const config = await storage.getDecryptedConfig()
    return {
      configured: !!config.github?.accessToken,
      processing: this.processing.size > 0,
      queueSize: (await storage.getCommitQueue()).length
    }
  }

  private async testGitHubConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await storage.getDecryptedConfig()
      
      if (!config.github?.accessToken) {
        return { success: false, error: 'No GitHub access token configured' }
      }

      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${config.github.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async handleAuthWithPAT(payload: {
    token: string
    owner?: string
    repository: string
    branch: string
  }): Promise<{ success: boolean; error?: string; config?: any }> {
    try {
      const config = await this.githubAuth.authenticateWithToken(payload.token)

      config.repository = payload.repository
      config.branch = payload.branch

      if (payload.owner && !config.username) {
        config.username = payload.owner
      }

      const currentConfig = await storage.getDecryptedConfig()
      currentConfig.github = config
      await storage.setConfig(currentConfig)

      return { success: true, config }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async handleFirstInstall(): Promise<void> {
    try {
      await this.browser.tabs.create({
        url: this.browser.runtime.getURL('onboarding.html')
      })
    } catch (error) {
      // Silent fail
    }
  }

  private async handleMissingAuth(): Promise<void> {
    this.showAuthRequiredNotification()
    
    try {
      await this.browser.tabs.create({
        url: this.browser.runtime.getURL('options.html')
      })
    } catch (error) {
      // Silent fail
    }
  }

  private async handleInvalidToken(_errorMessage: string): Promise<void> {
    // Clear the invalid token
    await this.githubAuth.clearInvalidToken()
    
    // Show notification about token issue
    this.showNotification(
      '🔐 LeetShip: Token Issue',
      'GitHub token is invalid or expired. Please re-authenticate.'
    )
    
    // Open options page for re-authentication
    try {
      await this.browser.tabs.create({
        url: this.browser.runtime.getURL('options.html')
      })
    } catch (error) {
      // Silent fail
    }
  }

  private showSuccessNotification(submission: LeetCodeSubmission): void {
    this.showNotification(
      '✅ LeetShip Success',
      `${submission.title} committed to GitHub!`
    )
  }

  private showErrorNotification(title: string, message: string): void {
    this.showNotification(
      `❌ LeetShip: ${title}`,
      message
    )
  }

  private showAuthRequiredNotification(): void {
    this.showNotification(
      '🔐 LeetShip: Setup Required',
      'Connect your GitHub account to commit solutions'
    )
  }

  private showNotification(title: string, message: string): void {
    try {
      this.browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title,
        message
      })
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Start periodic security maintenance tasks
   */
  private startSecurityMaintenance(): void {
    // Run security cleanup every 15 minutes
    setInterval(async () => {
      try {
        await tokenManager.performSecurityCleanup()
      } catch (error) {
        console.error('Security maintenance failed:', error)
      }
    }, 15 * 60 * 1000)

    // Run initial cleanup after 30 seconds
    setTimeout(async () => {
      await tokenManager.performSecurityCleanup()
    }, 30000)
  }

  /**
   * Enhanced token validation before processing
   */
  private async validateAuthentication(): Promise<boolean> {
    try {
      const isAuthenticated = await tokenManager.isAuthenticated()
      
      if (!isAuthenticated) {
        await this.handleMissingAuth()
        return false
      }

      // Get token to validate it
      const token = await tokenManager.getGitHubToken()
      if (!token) {
        await this.handleMissingAuth()
        return false
      }

      return true
    } catch (error) {
      console.error('Authentication validation failed:', error)
      await this.handleInvalidToken(error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }
}

new LeetShipBackgroundService()