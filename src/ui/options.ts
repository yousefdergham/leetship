import { getBrowser } from '../lib/browser'
import { storage } from '../lib/storage'
import { GitHubAuth } from '../lib/auth/github'
import { githubAPI } from '../lib/github/api'
import { TemplateEngine } from '../lib/templates'
import { ExtensionConfig, QueuedCommit } from '../lib/types'

class OptionsPage {
  private browser = getBrowser()
  private githubAuth = new GitHubAuth()
  private config: ExtensionConfig | null = null

  constructor() {
    this.initialize()
  }

  // ---------- lifecycle ----------

  private async initialize(): Promise<void> {
    try {
      await this.loadConfig()
      this.setupEventListeners()
      this.setupTabNavigation()
      await this.updateUI()
      await this.checkForInvalidTokens()
    } catch (error) {
      console.error('❌ Options page initialization failed:', error)
      this.showToast('Failed to initialize options page', 'error')
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      this.config = await storage.getDecryptedConfig()
    } catch (error) {
      console.error('Failed to load config:', error)
      if (error instanceof Error && /Malformed UTF-8/i.test(error.message)) {
        await this.handleStorageCorruption()
      } else {
        this.showToast('Error loading configuration', 'error')
      }
    }
  }

  // ---------- helpers ----------

  /** Get GitHub username (owner). */
  private getGitHubOwner(): string {
    return (this.config?.github?.username || '').trim()
  }

  private ensureEl<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id)
    if (!el) throw new Error(`Missing element #${id}`)
    return el as T
  }

  private addClearTokenButton(): void {
    const statusContainer = document.getElementById('status-container')
    if (!statusContainer) return
    document.getElementById('auto-clear-token')?.remove()
    const clearButton = document.createElement('button')
    clearButton.id = 'auto-clear-token'
    clearButton.className = 'btn btn-warning btn-sm'
    clearButton.textContent = 'Clear Invalid Token'
    clearButton.onclick = () => this.handleClearToken()
    statusContainer.appendChild(clearButton)
  }

  // ---------- token checks ----------

  private async checkForInvalidTokens(): Promise<void> {
    if (!this.config?.github?.accessToken) return
    try {
      const validation = await this.githubAuth.validateStoredToken()
      if (!validation.valid) {
        this.showInvalidTokenNotification(validation.error || 'Token is invalid')
      }
    } catch (error) {
      console.error('Failed to check token validity:', error)
    }
  }

  private showInvalidTokenNotification(error: string): void {
    const notification = document.createElement('div')
    notification.className = 'invalid-token-notification'
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">⚠️</div>
        <div class="notification-text">
          <strong>GitHub Token Issue</strong><br>
          ${error}
        </div>
        <div class="notification-actions">
          <button class="btn btn-warning btn-sm" onclick="optionsPage.handleClearToken()">Clear Token</button>
          <button class="btn btn-primary btn-sm" onclick="optionsPage.handleRegenerateToken()">Generate New Token</button>
        </div>
      </div>
    `
    ;(document.querySelector('.container') || document.body).insertBefore(
      notification,
      (document.querySelector('.container') || document.body).firstChild
    )
  }

  private async handleStorageCorruption(): Promise<void> {
    try {
      await storage.clearCorruptedData()
      await this.loadConfig()
      await this.updateUI()
      this.showToast('Storage corruption cleared. Please reconfigure GitHub.', 'success')
    } catch (error) {
      console.error('Failed to handle storage corruption:', error)
      this.showToast('Failed to clear corrupted data. Try refreshing.', 'error')
    }
  }

  // ---------- UI update ----------

  private async updateUI(): Promise<void> {
    await this.updateAuthStatus()
    await this.updateRepositoryUI()
    this.updateTemplateUI()
    this.updateSettingsUI()
    await this.updateQueueUI()
    this.updatePATForm()
  }

  private async updateAuthStatus(): Promise<void> {
    const statusIndicator = document.getElementById('status-indicator')
    const statusText = document.getElementById('status-text')
    const connectBtn = document.getElementById('connect-github')
    const disconnectBtn = document.getElementById('disconnect-github')
    const userInfo = document.getElementById('user-info')

    if (!this.config?.github?.accessToken) {
      statusIndicator?.classList.remove('connected', 'error')
      if (statusText) statusText.textContent = 'Not connected'
      connectBtn?.classList.remove('hidden')
      disconnectBtn?.classList.add('hidden')
      userInfo?.classList.add('hidden')
      return
    }

    const validation = await this.githubAuth.validateStoredToken()

    if (validation.valid) {
      statusIndicator?.classList.add('connected')
      statusIndicator?.classList.remove('error')
      if (statusText) {
        const login = validation.user?.login || this.getGitHubOwner() || 'GitHub'
        statusText.textContent = `Connected${login ? ' as ' + login : ''}`
      }
      connectBtn?.classList.add('hidden')
      disconnectBtn?.classList.remove('hidden')
      userInfo?.classList.remove('hidden')

      const userAvatar = document.getElementById('user-avatar') as HTMLImageElement | null
      const userName = document.getElementById('user-name')
      const userUsername = document.getElementById('user-username')
      if (validation.user) {
        if (userAvatar) userAvatar.src = validation.user.avatar_url
        if (userName) userName.textContent = validation.user.name || validation.user.login
        if (userUsername) userUsername.textContent = `@${validation.user.login}`
      } else {
        if (userAvatar) userAvatar.src = ''
        if (userName) userName.textContent = this.getGitHubOwner()
        if (userUsername) userUsername.textContent = ''
      }
    } else {
      statusIndicator?.classList.add('error')
      statusIndicator?.classList.remove('connected')
      if (statusText) statusText.textContent = 'Connection error'
      connectBtn?.classList.remove('hidden')
      disconnectBtn?.classList.add('hidden')
      userInfo?.classList.add('hidden')

      if (validation.error && /invalid|expired/i.test(validation.error)) {
        this.showToast(`Token is invalid: ${validation.error}`, 'warning')
        this.addClearTokenButton()
      } else if (validation.error) {
        this.showToast(`Authentication error: ${validation.error}`, 'error')
      }
    }
  }

  private async updateRepositoryUI(): Promise<void> {
    if (!this.config?.github?.accessToken) return
    try {
      const repositories = await githubAPI.getRepositories()
      const repositorySelect = this.ensureEl<HTMLSelectElement>('repository-select')
      repositorySelect.innerHTML = '<option value="">Select a repository</option>'

      const currentOwner = this.getGitHubOwner()
      const currentRepo = (this.config.github.repository || '').trim()

      repositories.forEach(repo => {
        const option = document.createElement('option')
        option.value = repo.full_name // "owner/repo"
        option.textContent = `${repo.full_name}${repo.private ? ' (Private)' : ''}`
        if (currentOwner && currentRepo && repo.full_name === `${currentOwner}/${currentRepo}`) {
          option.selected = true
        }
        repositorySelect.appendChild(option)
      })

      if (currentOwner && currentRepo) {
        await this.updateBranchUI(currentOwner, currentRepo)
      } else {
        const branchSelect = this.ensureEl<HTMLSelectElement>('branch-select')
        branchSelect.innerHTML = ''
      }
    } catch (error) {
      console.error('Failed to load repositories:', error)
      this.showToast('Failed to load repositories', 'error')
    }
  }

  private async updateBranchUI(owner: string, repo: string): Promise<void> {
    try {
      const branches = await githubAPI.getBranches(owner, repo)
      const branchSelect = this.ensureEl<HTMLSelectElement>('branch-select')
      branchSelect.innerHTML = ''
      const current = this.config?.github?.branch?.trim()

      branches.forEach(branch => {
        const option = document.createElement('option')
        option.value = branch.name
        option.textContent = branch.name
        if (current && branch.name === current) option.selected = true
        branchSelect.appendChild(option)
      })
    } catch (error) {
      console.error('Failed to load branches:', error)
      this.showToast('Failed to load branches', 'error')
    }
  }

  private updateTemplateUI(): void {
    if (!this.config) return
    const commitTemplate = this.ensureEl<HTMLTextAreaElement>('commit-template')
    const readmeTemplate = this.ensureEl<HTMLTextAreaElement>('readme-template')
    const folderTemplate = this.ensureEl<HTMLInputElement>('folder-template')

    commitTemplate.value = this.config.templates.commitMessage
    readmeTemplate.value = this.config.templates.readme
    folderTemplate.value = this.config.templates.folderLayout
    this.updateTemplatePreview()
  }

  private updateTemplatePreview(): void {
    const previewContent = document.getElementById('template-preview')
    if (!previewContent) return

    const variables = {
      id: '0001',
      title: 'Two Sum',
      slug: 'two-sum',
      difficulty: 'easy',
      tags: 'array, hash-table',
      lang: 'python',
      runtime: '52 ms',
      memory: '15.3 MB',
      timestamp: new Date().toISOString(),
      link: 'https://leetcode.com/problems/two-sum/',
      runtimePercentile: '85.4%',
      memoryPercentile: '92.1%',
    }

    const commitTemplate =
      (document.getElementById('commit-template') as HTMLTextAreaElement)?.value || ''
    const readmeTemplate =
      (document.getElementById('readme-template') as HTMLTextAreaElement)?.value || ''
    const folderTemplate =
      (document.getElementById('folder-template') as HTMLInputElement)?.value || ''

    const commitMessage = TemplateEngine.render(commitTemplate, variables)
    const folderPath = TemplateEngine.render(folderTemplate, variables)

    previewContent.textContent = `Folder: ${folderPath}/
Commit: ${commitMessage}

README Preview:
${TemplateEngine.render(readmeTemplate, variables).substring(0, 300)}...`
  }

  private updateSettingsUI(): void {
    if (!this.config) return
    const settings = this.config.settings
    Object.entries(settings).forEach(([key, value]) => {
      const el = document.getElementById(this.kebabCase(key)) as HTMLInputElement | null
      if (el && el.type === 'checkbox') el.checked = Boolean(value)
    })
  }

  private async updateQueueUI(): Promise<void> {
    const queueList = document.getElementById('queue-list')
    if (!queueList) return
    try {
      const queue = await storage.getCommitQueue()
      queueList.innerHTML =
        queue.length === 0
          ? '<div class="empty-state">No pending commits</div>'
          : queue.map(item => this.renderQueueItem(item)).join('')
    } catch (error) {
      console.error('Failed to load queue:', error)
      queueList.innerHTML = '<div class="empty-state">Failed to load queue</div>'
    }
  }

  private updatePATForm(): void {
    if (!this.config?.github) return
    const ownerInput = document.getElementById('pat-owner') as HTMLInputElement | null
    const repoInput = document.getElementById('pat-repository') as HTMLInputElement | null
    const branchInput = document.getElementById('pat-branch') as HTMLInputElement | null
    const ownerVal = this.getGitHubOwner()
    if (ownerInput && ownerVal) ownerInput.value = ownerVal
    if (repoInput && this.config.github.repository) repoInput.value = this.config.github.repository
    if (branchInput && this.config.github.branch) branchInput.value = this.config.github.branch
  }

  private renderQueueItem(item: QueuedCommit): string {
    const date = new Date(item.timestamp).toLocaleString()
    const hasError = item.lastError && item.retryCount > 0
    return `
      <div class="queue-item">
        <div class="queue-item-info">
          <h4>${item.submission.title}</h4>
          <div class="queue-item-meta">
            <span>${item.submission.difficulty}</span>
            <span>${item.submission.language}</span>
            <span>${date}</span>
            ${hasError ? `<span class="text-error">Retries: ${item.retryCount}</span>` : ''}
          </div>
          ${hasError ? `<div class="text-error">${item.lastError}</div>` : ''}
        </div>
        <div class="queue-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="optionsPage.retryCommit('${item.id}')">Retry</button>
          <button class="btn btn-danger btn-sm" onclick="optionsPage.removeFromQueue('${item.id}')">Remove</button>
        </div>
      </div>
    `
  }

  // ---------- events ----------

  private setupEventListeners(): void {
    // GitHub auth
    document
      .getElementById('connect-github')
      ?.addEventListener('click', () => this.handleConnectGitHub())
    document
      .getElementById('disconnect-github')
      ?.addEventListener('click', () => this.handleDisconnectGitHub())
    document
      .getElementById('test-connection')
      ?.addEventListener('click', () => this.handleTestConnection())
    document
      .getElementById('regenerate-token')
      ?.addEventListener('click', () => this.handleRegenerateToken())
    document.getElementById('clear-token')?.addEventListener('click', () => this.handleClearToken())

    // PAT flow
    document
      .getElementById('save-validate-pat')
      ?.addEventListener('click', () => this.handleSaveValidatePAT())
    document.getElementById('test-commit')?.addEventListener('click', () => this.handleTestCommit())
    document
      .getElementById('clear-corrupted-data')
      ?.addEventListener('click', () => this.handleStorageCorruption())

    // Repo/branch switching
    document.getElementById('repository-select')?.addEventListener('change', e => {
      this.handleRepositoryChange((e.target as HTMLSelectElement).value)
    })
    document
      .getElementById('create-repository')
      ?.addEventListener('click', () => this.handleCreateRepository())
    document.getElementById('branch-select')?.addEventListener('change', e => {
      this.handleBranchChange((e.target as HTMLSelectElement).value)
    })

    // Templates
    document
      .getElementById('save-templates')
      ?.addEventListener('click', () => this.handleSaveTemplates())
    document
      .getElementById('reset-templates')
      ?.addEventListener('click', () => this.handleResetTemplates())
    ;['commit-template', 'readme-template', 'folder-template'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateTemplatePreview())
    })

    // Settings
    document.querySelectorAll<HTMLElement>('[data-setting]').forEach(input => {
      input.addEventListener('change', e => {
        const target = e.target as HTMLInputElement
        this.handleSettingChange(
          target.dataset.setting!,
          target.type === 'checkbox' ? target.checked : !!target.value
        )
      })
    })

    // Onboarding
    document.getElementById('open-onboarding')?.addEventListener('click', e => {
      e.preventDefault()
      this.openOnboarding()
    })

    // Debug storage (temporary)
    document.getElementById('debug-storage')?.addEventListener('click', () => {
      this.debugStorage()
    })
  }

  private setupTabNavigation(): void {
    const navItems = document.querySelectorAll<HTMLElement>('.nav-item')
    const tabContents = document.querySelectorAll<HTMLElement>('.tab-content')

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabName = item.getAttribute('data-tab')
        if (!tabName) return
        navItems.forEach(n => n.classList.remove('active'))
        item.classList.add('active')
        tabContents.forEach(c => c.classList.remove('active'))
        const target = document.querySelector<HTMLElement>(`.tab-content[data-tab="${tabName}"]`)
        if (target) target.classList.add('active')
        this.handleTabChange(tabName)
      })
    })
  }

  // ---------- actions ----------

  private async handleConnectGitHub(): Promise<void> {
    try {
      if (this.config?.github?.accessToken) {
        const confirmed = confirm(
          'You already have a GitHub token configured. Open the token page to create a new one?'
        )
        if (confirmed) window.open('https://github.com/settings/tokens?type=beta', '_blank')
      } else {
        this.showToast('Use the PAT form below to connect your GitHub.', 'info')
      }
      this.browser.runtime.openOptionsPage()
    } catch (error) {
      console.error('GitHub connection failed:', error)
      this.showToast('Failed to connect to GitHub', 'error')
    }
  }

  private async handleDisconnectGitHub(): Promise<void> {
    try {
      await this.githubAuth.signOut()
      if (this.config) {
        this.config.github = null
        await storage.setConfig(this.config)
      }
      await this.updateUI()
      this.showToast('Disconnected from GitHub', 'success')
    } catch (error) {
      console.error('Disconnect failed:', error)
      this.showToast('Failed to disconnect', 'error')
    }
  }

  private async handleTestConnection(): Promise<void> {
    try {
      if (!this.config?.github?.accessToken) {
        this.showToast('No GitHub connection to test', 'warning')
        return
      }
      const validationResult = await this.githubAuth.validateToken(this.config.github.accessToken)
      this.showToast(
        validationResult.valid
          ? 'Connection test successful!'
          : `Connection test failed: ${validationResult.error || 'Invalid token'}`,
        validationResult.valid ? 'success' : 'error'
      )
    } catch (error) {
      console.error('Connection test failed:', error)
      this.showToast('Connection test failed', 'error')
    }
  }

  private async handleRegenerateToken(): Promise<void> {
    try {
      const instructions = await this.githubAuth.getTokenInstructions()
      const helpUrl = await this.githubAuth.getTokenHelpUrl()
      const confirmed = confirm(
        'This opens GitHub to create a new Personal Access Token.\n\n' +
          instructions +
          '\n\nProceed?'
      )
      if (confirmed) {
        window.open(helpUrl, '_blank')
        this.showToast('GitHub token page opened.', 'info')
        await this.githubAuth.clearInvalidToken()
        await this.loadConfig()
        await this.updateUI()
      }
    } catch (error) {
      console.error('Failed to regenerate token:', error)
      this.showToast('Failed to open token generation page', 'error')
    }
  }

  private async handleClearToken(): Promise<void> {
    try {
      const confirmed = confirm(
        'Clear your stored GitHub token and reset the connection?\nYou will need to paste a new token afterwards.'
      )
      if (!confirmed) return
      await this.githubAuth.clearInvalidToken()
      await this.loadConfig()
      await this.updateUI()
      document.getElementById('auto-clear-token')?.remove()
      this.showToast('Token cleared. Reconnect with a new token.', 'success')
      setTimeout(() => this.openOnboarding(), 600)
    } catch (error) {
      console.error('Failed to clear token:', error)
      this.showToast('Failed to clear token', 'error')
    }
  }

  private async handleRepositoryChange(fullName: string): Promise<void> {
    if (!this.config?.github || !fullName) return
    const [owner, repo] = fullName.split('/')
    this.config.github.username = owner
    this.config.github.repository = repo
    try {
      await storage.setConfig(this.config)
      await this.updateBranchUI(owner, repo)
      this.showToast(`Repository set to ${owner}/${repo}`, 'success')
    } catch (error) {
      console.error('Failed to update repository:', error)
      this.showToast('Failed to update repository', 'error')
    }
  }

  private async handleCreateRepository(): Promise<void> {
    this.showToast('Repository creation not yet implemented', 'warning')
  }

  private async handleBranchChange(branch: string): Promise<void> {
    if (!this.config?.github || !branch) return
    this.config.github.branch = branch
    try {
      await storage.setConfig(this.config)
      this.showToast(`Branch set to ${branch}`, 'success')
    } catch (error) {
      console.error('Failed to update branch:', error)
      this.showToast('Failed to update branch', 'error')
    }
  }

  private async handleSaveTemplates(): Promise<void> {
    if (!this.config) return
    const commitTemplate = (document.getElementById('commit-template') as HTMLTextAreaElement).value
    const readmeTemplate = (document.getElementById('readme-template') as HTMLTextAreaElement).value
    const folderTemplate = (document.getElementById('folder-template') as HTMLInputElement).value
    this.config.templates = {
      commitMessage: commitTemplate,
      readme: readmeTemplate,
      folderLayout: folderTemplate,
    }
    try {
      await storage.setConfig(this.config)
      this.showToast('Templates saved', 'success')
    } catch (error) {
      console.error('Failed to save templates:', error)
      this.showToast('Failed to save templates', 'error')
    }
  }

  private handleResetTemplates(): void {
    if (!confirm('Reset templates to default?')) return
    // if you have defaults in storage, call them here; for now just refresh UI
    this.showToast('Templates reset to default', 'success')
    this.updateTemplateUI()
  }

  private async handleSettingChange(settingKey: string, value: boolean): Promise<void> {
    if (!this.config) return
    const camelKey = this.camelCase(settingKey)
    if (camelKey in this.config.settings) {
      ;(this.config.settings as any)[camelKey] = value
      try {
        await storage.setConfig(this.config)
        this.showToast(`Setting updated: ${settingKey}`, 'success')
      } catch (error) {
        console.error('Failed to save setting:', error)
        this.showToast('Failed to save setting', 'error')
      }
    }
  }

  private async handleTabChange(tabName: string): Promise<void> {
    switch (tabName) {
      case 'account':
        await this.updateAuthStatus()
        break
      case 'repository':
        await this.updateRepositoryUI()
        break
      case 'queue':
        await this.updateQueueUI()
        break
      default:
        break
    }
  }

  private async openOnboarding(): Promise<void> {
    try {
      await this.browser.tabs.create({ url: this.browser.runtime.getURL('onboarding.html') })
    } catch (error) {
      console.error('Failed to open onboarding:', error)
    }
  }

  private async debugStorage(): Promise<void> {
    try {
      console.log('🔍 Debugging storage...')

      // Check regular storage
      const allStorage = await this.browser.storage.local.get()
      console.log('📦 All local storage keys:', Object.keys(allStorage))

      // Check session storage if available
      if (this.browser.storage.session) {
        const sessionStorage = await this.browser.storage.session.get()
        console.log('📦 Session storage keys:', Object.keys(sessionStorage))
      } else {
        console.log('📦 Session storage not available')
      }

      // Check secure storage
      const tokenManager = (await import('../lib/security/token-manager')).tokenManager
      const isAuthenticated = await tokenManager.isAuthenticated()
      console.log('🔐 Is authenticated:', isAuthenticated)

      const token = await tokenManager.getGitHubToken()
      console.log('🔐 Token available:', !!token)

      const metadata = await tokenManager.getTokenMetadata()
      console.log('🔐 Token metadata:', metadata)

      this.showToast('Storage debug info logged to console', 'info')
    } catch (error) {
      console.error('Debug storage failed:', error)
      this.showToast(
        'Debug failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'error'
      )
    }
  }

  // ---------- PAT flow ----------

  private async handleSaveValidatePAT(): Promise<void> {
    try {
      const token = (document.getElementById('pat-token') as HTMLInputElement)?.value?.trim()
      const owner = (document.getElementById('pat-owner') as HTMLInputElement)?.value?.trim()
      const repository = (
        document.getElementById('pat-repository') as HTMLInputElement
      )?.value?.trim()
      const branch =
        (document.getElementById('pat-branch') as HTMLInputElement)?.value?.trim() || 'main'

      if (!token) return this.showToast('Please enter a Personal Access Token', 'error')
      if (!owner) return this.showToast('Please enter the repository owner', 'error')
      if (!repository) return this.showToast('Please enter the repository name', 'error')

      // IMPORTANT: match the background service worker contract
      const response = await this.browser.runtime.sendMessage({
        type: 'AUTH_WITH_PAT',
        payload: {
          token,
          owner,
          repository,
          branch,
        },
      })

      if (response?.success) {
        this.showToast('GitHub authentication successful!', 'success')
        await this.loadConfig()
        await this.updateUI()
        ;(document.getElementById('pat-token') as HTMLInputElement).value = ''
        ;(document.getElementById('pat-owner') as HTMLInputElement).value = ''
        ;(document.getElementById('pat-repository') as HTMLInputElement).value = ''
        ;(document.getElementById('pat-branch') as HTMLInputElement).value = 'main'
      } else {
        this.showToast(`Authentication failed: ${response?.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('PAT authentication failed:', error)
      this.showToast(
        'Authentication failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'error'
      )
    }
  }

  private async handleTestCommit(): Promise<void> {
    try {
      if (!this.config?.github?.accessToken) {
        this.showToast('Please authenticate with GitHub first', 'warning')
        return
      }

      const owner = this.getGitHubOwner()
      const repository = this.config.github.repository

      if (!owner || !repository) {
        this.showToast('Please configure repository settings first', 'warning')
        return
      }

      this.showToast('Creating test commit...', 'info')

      const response = await this.browser.runtime.sendMessage({
        type: 'UPSERT_FILE',
        payload: {
          path: 'CommitTest.md',
          content: `# Test Commit

This is a test commit from LeetShip extension.

- **Timestamp**: ${new Date().toISOString()}
- **Extension**: LeetShip v1.0.2
- **Purpose**: Testing GitHub API integration

If you see this file, the GitHub integration is working correctly! 🎉

---

*This file was automatically generated by LeetShip extension.*`,
          message: 'test: Verify GitHub API integration',
          sha: undefined, // let background figure it out
        },
      })

      const ok = response?.success
      const commitUrl = response?.commitUrl

      if (ok && commitUrl) {
        this.showToast(`Test commit successful! Opening: ${commitUrl}`, 'success')
        setTimeout(() => window.open(commitUrl, '_blank'), 800)
      } else if (ok) {
        this.showToast('Test commit successful!', 'success')
      } else {
        this.showToast(`Test commit failed: ${response?.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Test commit failed:', error)
      this.showToast(
        'Test commit failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        'error'
      )
    }
  }

  // ---------- public (for inline handlers) ----------

  public async retryCommit(commitId: string): Promise<void> {
    try {
      await storage.updateCommitInQueue(commitId, { retryCount: 0, lastError: undefined })
      await this.browser.runtime.sendMessage({ type: 'PROCESS_QUEUE' })
      await this.updateQueueUI()
      this.showToast('Retrying commit...', 'info')
    } catch (error) {
      console.error('Failed to retry commit:', error)
      this.showToast('Failed to retry commit', 'error')
    }
  }

  public async removeFromQueue(commitId: string): Promise<void> {
    try {
      await storage.removeFromCommitQueue(commitId)
      await this.updateQueueUI()
      this.showToast('Removed from queue', 'success')
    } catch (error) {
      console.error('Failed to remove from queue:', error)
      this.showToast('Failed to remove from queue', 'error')
    }
  }

  // ---------- utils ----------

  private showToast(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ): void {
    const container = document.getElementById('toast-container')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    const title = type.charAt(0).toUpperCase() + type.slice(1)
    toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-message">${message}</div>`
    container.appendChild(toast)
    setTimeout(() => {
      toast.style.animation = 'toast-slide-in 0.3s ease-out reverse'
      setTimeout(() => toast.remove(), 300)
    }, 4000)
  }

  private kebabCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '')
  }

  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  }
}

// expose globally for onclick handlers in the HTML
const optionsPage = new OptionsPage()
;(window as any).optionsPage = optionsPage
