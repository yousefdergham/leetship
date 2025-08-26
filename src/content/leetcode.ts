import { LeetCodeSubmission } from '../lib/types'
import { getLanguageExtension, getDisplayName } from '../lib/leetcode/language-mapping'

/**
 * Production-ready LeetCode content script
 */

interface LeetCodeInterface {
  getSubmissionDetails(): Promise<LeetCodeSubmission | null>
  isSubmissionSuccess(): boolean
  getCode(): string | null
  getProblemInfo(): { title: string; titleSlug: string; difficulty: string } | null
}

class LeetCodeV1 implements LeetCodeInterface {
  async getSubmissionDetails(): Promise<LeetCodeSubmission | null> {
    if (!this.isSubmissionSuccess()) {
      return null
    }

    const problemInfo = this.getProblemInfo()
    const code = this.getCode()

    if (!problemInfo || !code) {
      return null
    }

    const language = this.getLanguage()
    const stats = this.getStats()

    return {
      id: Date.now().toString(),
      title: problemInfo.title,
      titleSlug: problemInfo.titleSlug,
      difficulty: problemInfo.difficulty as 'Easy' | 'Medium' | 'Hard',
      language,
      code,
      status: 'Accepted',
      runtime: stats.runtime || 'N/A',
      memory: stats.memory || 'N/A',
      timestamp: new Date().toISOString(),
      link: window.location.href,
      fileExtension: getLanguageExtension(language) || undefined,
      tags: [],
    }
  }

  isSubmissionSuccess(): boolean {
    const successSelectors = [
      '.fa-check-circle',
      '.accepted',
      'div[data-cy="accept-color"]',
      '.text-green-500',
      '.text-success',
      '[class*="success"]',
      '[class*="accepted"]',
      'svg[data-icon="check"]',
    ]

    for (const selector of successSelectors) {
      const elements = document.querySelectorAll(selector)

      for (const element of elements) {
        const text = element.textContent?.toLowerCase() || ''

        if (text.includes('accepted') || text.includes('success') || text.includes('correct')) {
          return true
        }
      }
    }

    return false
  }

  getCode(): string | null {
    const codeSelectors = [
      '.CodeMirror-code',
      '.ace_content',
      'textarea[name="code"]',
      '.CodeMirror textarea',
      '.ace_editor textarea',
      '[data-cy="code-area"]',
    ]

    for (const selector of codeSelectors) {
      const elements = document.querySelectorAll(selector)

      for (const element of elements) {
        let code = ''

        if (element.tagName === 'TEXTAREA') {
          code = (element as HTMLTextAreaElement).value
        } else {
          code = element.textContent || ''
        }

        code = code.trim()
        if (code && code.length > 10) {
          return code
        }
      }
    }

    return null
  }

  getProblemInfo(): { title: string; titleSlug: string; difficulty: string } | null {
    const titleElement = document.querySelector('[data-cy="question-title"], h3')
    if (!titleElement) return null

    const title = titleElement.textContent?.trim() || ''
    const titleSlug = this.extractTitleSlugFromUrl()
    const difficulty = this.extractDifficulty()

    return { title, titleSlug, difficulty }
  }

  private getLanguage(): string {
    const langSelectors = ['[data-cy="lang-select"] button span', '.ant-select-selection-item']

    for (const selector of langSelectors) {
      const element = document.querySelector(selector)
      const text = element?.textContent?.trim()
      if (text && text !== 'Select Language') {
        return getDisplayName(text)
      }
    }

    return 'Unknown'
  }

  private getStats(): { runtime: string; memory: string } {
    let runtime = 'N/A'
    let memory = 'N/A'

    const statsElements = document.querySelectorAll('[data-cy="runtime"], [data-cy="memory"]')
    statsElements.forEach(el => {
      const text = el.textContent || ''
      const runtimeMatch = text.match(/(\d+)\s*ms/)
      const memoryMatch = text.match(/([\d.]+)\s*MB/)

      if (runtimeMatch) runtime = `${runtimeMatch[1]} ms`
      if (memoryMatch) memory = `${memoryMatch[1]} MB`
    })

    return { runtime, memory }
  }

  private extractTitleSlugFromUrl(): string {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/)
    return match ? match[1] : ''
  }

  private extractDifficulty(): string {
    const difficultyElement = document.querySelector('[data-degree]')
    if (difficultyElement) {
      const degree = difficultyElement.getAttribute('data-degree')
      switch (degree) {
        case '1':
          return 'Easy'
        case '2':
          return 'Medium'
        case '3':
          return 'Hard'
      }
    }

    const text = document.body.textContent?.toLowerCase() || ''
    if (text.includes('easy')) return 'Easy'
    if (text.includes('medium')) return 'Medium'
    if (text.includes('hard')) return 'Hard'

    return 'Easy'
  }
}

class LeetCodeV2 implements LeetCodeInterface {
  async getSubmissionDetails(): Promise<LeetCodeSubmission | null> {
    if (!this.isSubmissionSuccess()) {
      return null
    }

    const submissionId = await this.findSubmissionId()
    if (submissionId) {
      return await this.getSubmissionFromGraphQL(submissionId)
    }

    return await this.getSubmissionFromPage()
  }

  isSubmissionSuccess(): boolean {
    const successSelectors = [
      '[data-e2e-locator="submission-result"]',
      '[data-testid="submission-result"]',
      '.submission-result',
      '[class*="text-green"]',
      '[class*="bg-green"]',
      '.text-success',
      '.bg-success',
      '[aria-label*="Accepted"]',
      '[title*="Accepted"]',
      'svg[data-icon="check"]',
      '.fa-check',
      '.checkmark',
    ]

    for (const selector of successSelectors) {
      const elements = document.querySelectorAll(selector)

      for (const element of elements) {
        const text = element.textContent?.toLowerCase() || ''
        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || ''
        const title = element.getAttribute('title')?.toLowerCase() || ''
        const className = element.className?.toLowerCase() || ''

        const successKeywords = [
          'accepted',
          'success',
          'correct',
          'passed',
          'great job',
          'well done',
        ]
        const allText = `${text} ${ariaLabel} ${title} ${className}`.toLowerCase()

        if (successKeywords.some(keyword => allText.includes(keyword))) {
          return true
        }
      }
    }

    const statusElements = document.querySelectorAll(
      '[class*="status"], [class*="result"], [data-status]'
    )

    for (const element of statusElements) {
      const text = element.textContent?.toLowerCase() || ''
      const dataStatus = element.getAttribute('data-status')?.toLowerCase() || ''

      if (
        (text.includes('accepted') || dataStatus.includes('accepted')) &&
        !text.includes('wrong') &&
        !text.includes('error')
      ) {
        return true
      }
    }

    return false
  }

  getCode(): string | null {
    try {
      const monaco = (window as any).monaco
      if (monaco?.editor) {
        const models = monaco.editor.getModels()
        if (models && models.length > 0) {
          const code = models[0].getValue()
          return code
        }
      }
    } catch (e) {}

    const codeSelectors = [
      '.monaco-editor .view-lines',
      '.monaco-editor textarea',
      '.view-lines .view-line',
      '.CodeMirror-code',
      '.CodeMirror textarea',
      '.code-editor textarea',
      'textarea[data-mode]',
      '[data-cy="code-area"]',
      '.ace_content',
      '[contenteditable="true"][data-mode]',
      '.editor-content',
    ]

    for (const selector of codeSelectors) {
      const elements = document.querySelectorAll(selector)

      for (const element of elements) {
        let code = ''

        if (element.tagName === 'TEXTAREA') {
          code = (element as HTMLTextAreaElement).value
        } else if (element.hasAttribute('contenteditable')) {
          code = element.textContent || ''
        } else {
          if (selector.includes('view-line')) {
            const lines = Array.from(element.parentElement?.children || [])
              .filter(line => line.classList.contains('view-line'))
              .map(line => line.textContent || '')

            if (lines.length > 0) {
              code = lines.join('\n')
            }
          } else {
            code = element.textContent || ''
          }
        }

        code = code.trim()
        if (code && code.length > 10) {
          return code
        }
      }
    }

    const allTextareas = document.querySelectorAll('textarea')
    for (const textarea of allTextareas) {
      const code = textarea.value.trim()
      if (
        code &&
        code.length > 20 &&
        (code.includes('function') || code.includes('class') || code.includes('def'))
      ) {
        return code
      }
    }

    return null
  }

  getProblemInfo(): { title: string; titleSlug: string; difficulty: string } | null {
    const titleElement = document.querySelector('[data-cy="question-title"], h1, h2')
    if (!titleElement) return null

    const title = titleElement.textContent?.trim() || ''
    const titleSlug = this.extractTitleSlugFromUrl()
    const difficulty = this.extractDifficulty()

    return { title, titleSlug, difficulty }
  }

  private async findSubmissionId(): Promise<string | null> {
    const urlMatch = window.location.href.match(/submissions\/(\d+)/)
    if (urlMatch) {
      return urlMatch[1]
    }

    const submissionElements = document.querySelectorAll('[data-submission-id]')
    for (const el of submissionElements) {
      const id = el.getAttribute('data-submission-id')
      if (id) return id
    }

    return null
  }

  private async getSubmissionFromGraphQL(submissionId: string): Promise<LeetCodeSubmission | null> {
    const query = {
      query: `query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          runtime
          runtimeDisplay
          memory
          memoryDisplay
          code
          timestamp
          statusCode
          lang {
            name
            verboseName
          }
          question {
            questionId
            title
            titleSlug
            difficulty
          }
        }
      }`,
      variables: { submissionId: parseInt(submissionId) },
    }

    try {
      const response = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://leetcode.com/',
        },
        body: JSON.stringify(query),
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`)
      }

      const data = await response.json()
      const details = data.data?.submissionDetails

      if (!details) {
        throw new Error('No submission details found')
      }

      return {
        id: submissionId,
        title: details.question.title,
        titleSlug: details.question.titleSlug,
        difficulty: details.question.difficulty as 'Easy' | 'Medium' | 'Hard',
        language: details.lang.verboseName || details.lang.name,
        code: details.code,
        status: 'Accepted',
        runtime: details.runtimeDisplay || `${details.runtime} ms`,
        memory: details.memoryDisplay || `${details.memory} MB`,
        timestamp: new Date().toISOString(),
        link: window.location.href,
        fileExtension:
          getLanguageExtension(details.lang.verboseName || details.lang.name) || undefined,
        tags: [],
      }
    } catch (error) {
      return null
    }
  }

  private async getSubmissionFromPage(): Promise<LeetCodeSubmission | null> {
    const problemInfo = this.getProblemInfo()
    const code = this.getCode()

    if (!problemInfo || !code) return null

    const language = this.getLanguage()
    const stats = this.getStats()

    return {
      id: Date.now().toString(),
      title: problemInfo.title,
      titleSlug: problemInfo.titleSlug,
      difficulty: problemInfo.difficulty as 'Easy' | 'Medium' | 'Hard',
      language,
      code,
      status: 'Accepted',
      runtime: stats.runtime || 'N/A',
      memory: stats.memory || 'N/A',
      timestamp: new Date().toISOString(),
      link: window.location.href,
      fileExtension: getLanguageExtension(language) || undefined,
      tags: [],
    }
  }

  private getLanguage(): string {
    const langSelectors = [
      '[data-cy="lang-select"] .ant-select-selection-item',
      '.ant-select-selection-item',
      '[role="combobox"] span',
    ]

    for (const selector of langSelectors) {
      const element = document.querySelector(selector)
      const text = element?.textContent?.trim()
      if (text && text !== 'Select Language') {
        return getDisplayName(text)
      }
    }

    return 'Unknown'
  }

  private getStats(): { runtime: string; memory: string } {
    let runtime = 'N/A'
    let memory = 'N/A'

    const allElements = document.querySelectorAll('[data-e2e-locator="submission-result"] *')
    allElements.forEach(el => {
      const text = el.textContent || ''
      const runtimeMatch = text.match(/(\d+)\s*ms/)
      const memoryMatch = text.match(/([\d.]+)\s*MB/)

      if (runtimeMatch) runtime = `${runtimeMatch[1]} ms`
      if (memoryMatch) memory = `${memoryMatch[1]} MB`
    })

    return { runtime, memory }
  }

  private extractTitleSlugFromUrl(): string {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/)
    return match ? match[1] : ''
  }

  private extractDifficulty(): string {
    const difficultySelectors = [
      '[class*="text-olive"]',
      '[class*="text-yellow"]',
      '[class*="text-red"]',
      '[class*="bg-olive"]',
      '[class*="bg-yellow"]',
      '[class*="bg-red"]',
    ]

    for (const selector of difficultySelectors) {
      const element = document.querySelector(selector)
      if (element) {
        const text = element.textContent?.toLowerCase() || ''
        if (text.includes('easy')) return 'Easy'
        if (text.includes('medium')) return 'Medium'
        if (text.includes('hard')) return 'Hard'
      }
    }

    return 'Easy'
  }
}

class LeetShipLeetCodeContent {
  private isProcessing = false
  private observer: MutationObserver | null = null

  constructor() {
    this.initialize()
  }

  private async initialize() {
    this.setupButtonObservers()
    this.setupKeyboardShortcuts()
    this.setupNavigationHandler()
  }

  private setupButtonObservers() {
    this.observer = new MutationObserver(() => {
      const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]')
      const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]')

      if (v1SubmitBtn && !v1SubmitBtn.hasAttribute('data-LeetShip-monitored')) {
        v1SubmitBtn.setAttribute('data-LeetShip-monitored', 'true')
        v1SubmitBtn.addEventListener('click', () => {
          this.handleSubmission(new LeetCodeV1())
        })
      }

      if (v2SubmitBtn && !v2SubmitBtn.hasAttribute('data-LeetShip-monitored')) {
        v2SubmitBtn.setAttribute('data-LeetShip-monitored', 'true')
        v2SubmitBtn.addEventListener('click', () => {
          this.handleSubmission(new LeetCodeV2())
        })
      }
    })

    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', event => {
      const isEnterKey = event.key === 'Enter'
      const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0

      if (isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey))) {
        const v2Interface = document.querySelector('[data-e2e-locator="console-submit-button"]')
        const leetCode = v2Interface ? new LeetCodeV2() : new LeetCodeV1()

        this.handleSubmission(leetCode)
      }
    })
  }

  private setupNavigationHandler() {
    let lastUrl = location.href

    const checkUrlChange = () => {
      const currentUrl = location.href
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        this.isProcessing = false

        if (this.observer) {
          this.observer.disconnect()
        }
        setTimeout(() => this.setupButtonObservers(), 1000)
      }
    }

    setInterval(checkUrlChange, 1000)
    window.addEventListener('popstate', checkUrlChange)
  }

  private async handleSubmission(leetCodeInterface: LeetCodeInterface) {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      await this.waitForSubmission()

      let submission = await leetCodeInterface.getSubmissionDetails()

      if (submission) {
        await this.processSuccessfulSubmission(submission)
        return
      }

      await new Promise(resolve => setTimeout(resolve, 2000))

      submission = await leetCodeInterface.getSubmissionDetails()
      if (submission) {
        await this.processSuccessfulSubmission(submission)
        return
      }

      const resultFound = await this.waitForResultWithObserver(leetCodeInterface)

      if (resultFound) {
        return
      }
    } catch (error) {
      this.showErrorNotification('Failed to process submission')
    } finally {
      this.isProcessing = false
    }
  }

  private async waitForSubmission(): Promise<void> {
    return new Promise(resolve => {
      let attempts = 0
      const maxAttempts = 30

      const checkSubmission = () => {
        attempts++
        const isComplete = this.isSubmissionComplete()

        if (isComplete || attempts >= maxAttempts) {
          resolve()
        } else {
          setTimeout(checkSubmission, 500)
        }
      }

      setTimeout(checkSubmission, 3000)
    })
  }

  private isSubmissionComplete(): boolean {
    const completionSelectors = [
      '[data-e2e-locator="submission-result"]',
      '[data-testid="submission-result"]',
      '.submission-result',
      '.accepted',
      '.wrong-answer',
      '.time-limit-exceeded',
      '.runtime-error',
      '.memory-limit-exceeded',
      '.output-limit-exceeded',
      '.compilation-error',
      '[class*="result"]',
      '[class*="status"]',
    ]

    for (const selector of completionSelectors) {
      const elements = document.querySelectorAll(selector)
      if (elements.length > 0) {
        for (const element of elements) {
          const text = element.textContent?.trim() || ''
          if (text.length > 0) {
            return true
          }
        }
      }
    }

    return false
  }

  private async waitForResultWithObserver(leetCodeInterface: LeetCodeInterface): Promise<boolean> {
    return new Promise(resolve => {
      let timeout: NodeJS.Timeout

      const observer = new MutationObserver(async () => {
        setTimeout(async () => {
          const submission = await leetCodeInterface.getSubmissionDetails()
          if (submission) {
            await this.processSuccessfulSubmission(submission)
            observer.disconnect()
            clearTimeout(timeout)
            resolve(true)
          }
        }, 1000)
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-e2e-locator', 'data-testid'],
      })

      timeout = setTimeout(() => {
        observer.disconnect()
        resolve(false)
      }, 10000)
    })
  }

  private async processSuccessfulSubmission(submission: LeetCodeSubmission) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SUBMISSION_ACCEPTED',
        submission,
      })

      if (response?.success) {
        this.showSuccessNotification(submission)
      } else {
        this.showErrorNotification(response?.error || 'Failed to commit to GitHub')
      }
    } catch (error) {
      this.showErrorNotification('Extension communication error')
    }
  }

  private showSuccessNotification(submission: LeetCodeSubmission) {
    this.showNotification(
      '✅ LeetShip Success',
      `${submission.title} committed to GitHub!`,
      '#10b981'
    )
  }

  private showErrorNotification(message: string) {
    this.showNotification('❌ LeetShip Error', message, '#ef4444')
  }

  private showNotification(title: string, message: string, color: string) {
    const existing = document.getElementById('leetship-notification')
    if (existing) existing.remove()

    const notification = document.createElement('div')
    notification.id = 'leetship-notification'
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        max-width: 320px;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="opacity: 0.9;">${message}</div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(notification)

    setTimeout(() => {
      notification.remove()
      style.remove()
    }, 4000)
  }
}

new LeetShipLeetCodeContent()
