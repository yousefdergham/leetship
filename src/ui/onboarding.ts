import { getBrowser } from '../lib/browser'
import { storage } from '../lib/storage'
import { GitHubAuth } from '../lib/auth/github'
import { githubAPI } from '../lib/github/api'
import { ExtensionConfig } from '../lib/types'

class OnboardingPage {
  private browser = getBrowser()
  private githubAuth = new GitHubAuth()
  private currentStep = 1
  private config: ExtensionConfig | null = null

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    await this.loadConfig()
    this.setupEventListeners()
    this.showStep(1)
  }

  private async loadConfig(): Promise<void> {
    try {
      this.config = await storage.getDecryptedConfig()
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  private setupEventListeners(): void {
    // Step navigation
    document.getElementById('next-step')?.addEventListener('click', () => this.nextStep())
    document.getElementById('prev-step')?.addEventListener('click', () => this.previousStep())

    // Token input and validation
    document.getElementById('token-input')?.addEventListener('input', e => {
      this.handleTokenInput(e.target as HTMLInputElement)
    })

    document.getElementById('test-token')?.addEventListener('click', () => {
      this.handleTestToken()
    })

    document.getElementById('connect-github')?.addEventListener('click', () => {
      this.handleConnectGitHub()
    })

    document.getElementById('create-token')?.addEventListener('click', () => {
      this.handleCreateToken()
    })

    // Repository options
    const repoOptions = document.querySelectorAll('input[name="repo-option"]')
    repoOptions.forEach(option => {
      option.addEventListener('change', e => {
        this.handleRepositoryOptionChange((e.target as HTMLInputElement).value)
      })
    })

    // Repository setup
    document.getElementById('setup-repository')?.addEventListener('click', () => {
      this.handleRepositorySetup()
    })

    // Configuration save
    document.getElementById('save-config')?.addEventListener('click', () => {
      this.handleSaveConfiguration()
    })

    // Quick actions
    document.getElementById('open-options')?.addEventListener('click', () => {
      this.openOptionsPage()
    })

    // Navigation buttons
    document.getElementById('get-started-btn')?.addEventListener('click', () => {
      this.nextStep()
    })

    document.getElementById('back-step2-btn')?.addEventListener('click', () => {
      this.previousStep()
    })

    document.getElementById('back-step3-btn')?.addEventListener('click', () => {
      this.previousStep()
    })

    document.getElementById('back-step4-btn')?.addEventListener('click', () => {
      this.previousStep()
    })

    document.getElementById('complete-onboarding-btn')?.addEventListener('click', () => {
      this.completeOnboarding()
    })

    document.getElementById('goto-leetcode-btn')?.addEventListener('click', () => {
      window.open('https://leetcode.com', '_blank')
    })

    // Global functions for navigation (legacy support)
    ;(window as any).nextStep = () => this.nextStep()
    ;(window as any).previousStep = () => this.previousStep()
    ;(window as any).completeOnboarding = () => this.completeOnboarding()
  }

  private showStep(step: number): void {
    this.currentStep = step

    // Hide all steps
    const steps = document.querySelectorAll('.onboarding-step')
    steps.forEach(s => s.classList.add('hidden'))

    // Show current step
    const currentStepElement = document.getElementById(`step-${step}`)
    if (currentStepElement) {
      currentStepElement.classList.remove('hidden')
    }

    // Update progress indicator
    this.updateProgressIndicator()

    // Handle step-specific actions
    this.handleStepChange(step)
  }

  private async handleStepChange(step: number): Promise<void> {
    switch (step) {
      case 3:
        // Load repositories when reaching repository setup step
        if (this.config?.github?.accessToken) {
          await this.loadRepositories()
        }
        break
    }
  }

  private updateProgressIndicator(): void {
    const progressBar = document.getElementById('progress-bar')
    if (progressBar) {
      const progress = (this.currentStep / 4) * 100
      progressBar.style.width = `${progress}%`
    }

    const stepIndicator = document.getElementById('step-indicator')
    if (stepIndicator) {
      stepIndicator.textContent = `Step ${this.currentStep} of 4`
    }
  }

  private nextStep(): void {
    if (this.currentStep < 4) {
      this.showStep(this.currentStep + 1)
    }
  }

  private previousStep(): void {
    if (this.currentStep > 1) {
      this.showStep(this.currentStep - 1)
    }
  }

  private handleTokenInput(input: HTMLInputElement): void {
    const token = input.value.trim()
    const testButton = document.getElementById('test-token') as HTMLButtonElement
    const connectButton = document.getElementById('connect-github') as HTMLButtonElement

    if (token.length > 0) {
      testButton?.removeAttribute('disabled')
      connectButton?.removeAttribute('disabled')
    } else {
      testButton?.setAttribute('disabled', 'true')
      connectButton?.setAttribute('disabled', 'true')
    }
  }

  private async handleTestToken(): Promise<void> {
    const tokenInput = document.getElementById('token-input') as HTMLInputElement
    const token = tokenInput.value.trim()
    const testButton = document.getElementById('test-token') as HTMLButtonElement
    const statusText = document.getElementById('token-status')

    if (!token) {
      this.showToast('Please enter a token first', 'warning')
      return
    }

    // Basic token format validation for both classic and fine-grained tokens
    if (
      !token.startsWith('ghp_') &&
      !token.startsWith('gho_') &&
      !token.startsWith('ghu_') &&
      !token.startsWith('github_pat_')
    ) {
      if (statusText) {
        statusText.textContent =
          '❌ Invalid token format (should start with ghp_, gho_, ghu_, or github_pat_)'
        statusText.className = 'text-red-600 font-medium'
      }
      this.showToast('Invalid token format. Please check your token.', 'error')
      return
    }

    if (token.length < 40) {
      if (statusText) {
        statusText.textContent = '❌ Token too short (should be 40+ characters)'
        statusText.className = 'text-red-600 font-medium'
      }
      this.showToast('Token appears too short. Please check your token.', 'error')
      return
    }

    try {
      testButton.setAttribute('disabled', 'true')
      if (statusText) statusText.textContent = 'Testing token...'

      const validationResult = await this.githubAuth.validateToken(token)

      if (validationResult.valid) {
        if (statusText) {
          statusText.textContent = '✅ Token is valid!'
          statusText.className = 'text-green-600 font-medium'
        }
        this.showToast('Token validation successful!', 'success')
      } else {
        if (statusText) {
          statusText.textContent = `❌ ${validationResult.error || 'Token is invalid'}`
          statusText.className = 'text-red-600 font-medium'
        }
        this.showToast(
          validationResult.error || 'Token validation failed. Please check your token.',
          'error'
        )
      }
    } catch (error) {
      console.error('Token test failed:', error)
      if (statusText) {
        statusText.textContent = '❌ Token test failed'
        statusText.className = 'text-red-600 font-medium'
      }

      // Provide more specific error messages
      if (error instanceof Error && error.message.includes('401')) {
        this.showToast(
          'Token is invalid or expired. Please generate a new token with "repo" scope.',
          'error'
        )
      } else {
        this.showToast('Token test failed. Please check your token.', 'error')
      }
    } finally {
      testButton.removeAttribute('disabled')
    }
  }

  private handleCreateToken(): void {
    const confirmed = confirm(
      'This will open GitHub to create a new Personal Access Token.\n\n' +
        'Important steps:\n' +
        '1. Set Note to "LeetShip Extension"\n' +
        '2. For Classic Token: Select "repo" scope\n' +
        '3. For Fine-grained Token: Set "Contents" to "Read and write"\n' +
        '4. Choose expiration (or "No expiration")\n' +
        '5. Click "Generate token"\n' +
        '6. Copy the token and paste it here\n\n' +
        'Would you like to proceed?'
    )

    if (confirmed) {
      window.open('https://github.com/settings/tokens/new', '_blank')
      this.showToast(
        'GitHub token creation page opened. Please create a token with proper permissions.',
        'info'
      )
    }
  }

  private async handleConnectGitHub(): Promise<void> {
    const tokenInput = document.getElementById('token-input') as HTMLInputElement
    const token = tokenInput.value.trim()
    const connectButton = document.getElementById('connect-github') as HTMLButtonElement
    const statusText = document.getElementById('connection-status')

    if (!token) {
      this.showToast('Please enter a token first', 'warning')
      return
    }

    try {
      connectButton.setAttribute('disabled', 'true')
      if (statusText) statusText.textContent = 'Connecting to GitHub...'
      const githubConfig = await this.githubAuth.authenticateWithToken(token)

      if (this.config) {
        this.config.github = githubConfig
        await storage.setConfig(this.config)
      }

      if (statusText) {
        statusText.textContent = `✅ Connected as ${githubConfig.username}`
        statusText.className = 'text-green-600 font-medium'
      }

      this.showToast(`Successfully connected as ${githubConfig.username}!`, 'success')

      // Auto advance to next step after successful connection
      setTimeout(() => this.nextStep(), 1500)
    } catch (error) {
      console.error('GitHub connection failed:', error)

      if (statusText) {
        statusText.textContent = '❌ Connection failed'
        statusText.className = 'text-red-600 font-medium'
      }
      connectButton.removeAttribute('disabled')

      this.showToast('Failed to connect to GitHub. Please check your token.', 'error')
    }
  }

  private handleRepositoryOptionChange(option: string): void {
    const existingSection = document.getElementById('existing-repo-section')
    const newSection = document.getElementById('new-repo-section')

    if (option === 'existing') {
      existingSection?.classList.remove('hidden')
      newSection?.classList.add('hidden')
      this.loadRepositories()
    } else {
      existingSection?.classList.add('hidden')
      newSection?.classList.remove('hidden')
    }
  }

  private async loadRepositories(): Promise<void> {
    if (!this.config?.github?.accessToken) return

    try {
      const repositories = await githubAPI.getRepositories()
      const select = document.getElementById('repository-select-onboarding') as HTMLSelectElement

      select.innerHTML = '<option value="">Select a repository</option>'

      repositories.forEach(repo => {
        const option = document.createElement('option')
        option.value = repo.full_name
        option.textContent = `${repo.name}${repo.private ? ' (Private)' : ''}`
        select.appendChild(option)
      })
    } catch (error) {
      console.error('Failed to load repositories:', error)
      this.showToast('Failed to load repositories', 'error')
    }
  }

  private async handleRepositorySetup(): Promise<void> {
    const repoOption = (
      document.querySelector('input[name="repo-option"]:checked') as HTMLInputElement
    )?.value

    if (repoOption === 'existing') {
      await this.handleExistingRepository()
    } else {
      await this.handleNewRepository()
    }
  }

  private async handleExistingRepository(): Promise<void> {
    const select = document.getElementById('repository-select-onboarding') as HTMLSelectElement
    const branchSelect = document.getElementById('branch-select-onboarding') as HTMLSelectElement

    if (!select.value) {
      this.showToast('Please select a repository', 'warning')
      return
    }

    try {
      const [owner, repo] = select.value.split('/')
      const branches = await githubAPI.getBranches(owner, repo)
      branchSelect.innerHTML = '<option value="">Select a branch</option>'

      branches.forEach(branch => {
        const option = document.createElement('option')
        option.value = branch.name
        option.textContent = branch.name
        if (branch.name === 'main' || branch.name === 'master') {
          option.selected = true
        }
        branchSelect.appendChild(option)
      })

      if (this.config) {
        const [, repo] = select.value.split('/')
        this.config.github!.repository = repo
        this.config.github!.branch = branchSelect.value || 'main'
        await storage.setConfig(this.config)
      }

      this.showToast('Repository configured successfully!', 'success')
      setTimeout(() => this.nextStep(), 1000)
    } catch (error) {
      console.error('Failed to configure repository:', error)
      this.showToast('Failed to configure repository', 'error')
    }
  }

  private async handleNewRepository(): Promise<void> {
    const repoNameInput = document.getElementById('new-repo-name') as HTMLInputElement
    const repoName = repoNameInput.value.trim()

    if (!repoName) {
      this.showToast('Please enter a repository name', 'warning')
      return
    }

    // For now, we'll just save the repository name and let the user create it manually
    // TODO: Implement repository creation via GitHub API
    if (this.config) {
      this.config.github!.repository = repoName
      this.config.github!.branch = 'main'
      await storage.setConfig(this.config)
    }

    this.showToast(
      'Repository name saved. Please create the repository on GitHub and select it from existing repositories.',
      'info'
    )
    setTimeout(() => this.nextStep(), 2000)
  }

  private async handleSaveConfiguration(): Promise<void> {
    try {
      if (this.config) {
        await storage.setConfig(this.config)
        this.showToast('Configuration saved successfully!', 'success')
        setTimeout(() => this.nextStep(), 1000)
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
      this.showToast('Failed to save configuration', 'error')
    }
  }

  private openOptionsPage(): void {
    this.browser.runtime.openOptionsPage()
  }

  private completeOnboarding(): void {
    // Redirect to options page
    this.browser.runtime.openOptionsPage()

    // Close onboarding page
    window.close()
  }

  private showToast(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ): void {
    const container = document.getElementById('toast-container')
    if (!container) return

    const toast = document.createElement('div')
    toast.className = `toast ${type}`

    const title = type.charAt(0).toUpperCase() + type.slice(1)
    toast.innerHTML = `
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    `

    container.appendChild(toast)

    setTimeout(() => {
      toast.style.animation = 'toast-slide-in 0.3s ease-out reverse'
      setTimeout(() => toast.remove(), 300)
    }, 4000)
  }
}

new OnboardingPage()
