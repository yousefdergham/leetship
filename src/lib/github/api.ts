import { GitHubFile } from '../types'
import { storage } from '../storage'

export interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  default_branch: string
  permissions: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

export interface Branch {
  name: string
  commit: {
    sha: string
  }
  protected: boolean
}

export interface CommitResult {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
}

export class GitHubAPI {
  private baseURL = 'https://api.github.com'

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const config = await storage.getDecryptedConfig()

    if (!config.github?.accessToken) {
      throw new Error('No GitHub access token available')
    }

    return {
      Authorization: `token ${config.github.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'LeetShip (+webextension)',
      'Content-Type': 'application/json',
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getAuthHeaders()

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()

      // Handle token expiration/invalid token
      if (response.status === 401) {
        // Clear the invalid token to force re-authentication
        await storage.forceTokenRefresh()
        throw new Error(
          `GitHub API error (${response.status}): Bad credentials. Please re-authenticate with a valid token.`
        )
      }

      // Handle other specific errors
      if (response.status === 403) {
        try {
          const errorData = JSON.parse(errorBody)
          if (errorData.message?.includes('rate limit')) {
            throw new Error(`GitHub API rate limit exceeded. Please try again later.`)
          }
        } catch (parseError) {
          // Fall through to generic error
        }
      }

      throw new Error(`GitHub API error (${response.status}): ${errorBody}`)
    }

    return await response.json()
  }

  async getCurrentUser(): Promise<any> {
    return await this.makeRequest('/user')
  }

  async getRepositories(): Promise<Repository[]> {
    const repos = await this.makeRequest<Repository[]>('/user/repos?sort=updated&per_page=100')
    return repos.filter(repo => repo.permissions.push)
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    return await this.makeRequest<Repository>(`/repos/${owner}/${repo}`)
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    return await this.makeRequest<Branch[]>(`/repos/${owner}/${repo}/branches`)
  }

  async getFile(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<GitHubFile | null> {
    try {
      const endpoint = `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
      const url = branch ? `${endpoint}?ref=${branch}` : endpoint

      return await this.makeRequest<GitHubFile>(url)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<CommitResult> {
    const encodedContent = btoa(unescape(encodeURIComponent(content)))

    const body: any = {
      message,
      content: encodedContent,
    }

    if (branch) {
      body.branch = branch
    }

    const response = await this.makeRequest<any>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    )

    return response.commit
  }

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<CommitResult> {
    const encodedContent = btoa(unescape(encodeURIComponent(content)))

    const body: any = {
      message,
      content: encodedContent,
      sha,
    }

    if (branch) {
      body.branch = branch
    }

    const response = await this.makeRequest<any>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    )

    return response.commit
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<CommitResult> {
    const existingFile = await this.getFile(owner, repo, path, branch)

    if (existingFile) {
      return await this.updateFile(owner, repo, path, content, message, existingFile.sha, branch)
    } else {
      return await this.createFile(owner, repo, path, content, message, branch)
    }
  }

  async createMultipleFiles(
    owner: string,
    repo: string,
    files: Array<{
      path: string
      content: string
    }>,
    message: string,
    branch?: string
  ): Promise<CommitResult[]> {
    const results: CommitResult[] = []

    for (const file of files) {
      const result = await this.createOrUpdateFile(
        owner,
        repo,
        file.path,
        file.content,
        message,
        branch
      )
      results.push(result)

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return results
  }

  async checkRateLimit(): Promise<{
    limit: number
    remaining: number
    reset: number
    used: number
  }> {
    const response = await this.makeRequest<any>('/rate_limit')
    return response.rate
  }

  async testRepositoryAccess(
    owner: string,
    repo: string
  ): Promise<{
    accessible: boolean
    permissions: {
      admin: boolean
      push: boolean
      pull: boolean
    } | null
    error?: string
  }> {
    try {
      const repository = await this.getRepository(owner, repo)
      return {
        accessible: true,
        permissions: repository.permissions,
      }
    } catch (error) {
      return {
        accessible: false,
        permissions: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

export const githubAPI = new GitHubAPI()
