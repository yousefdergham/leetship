export interface LeetCodeSubmission {
  id: string
  title: string
  titleSlug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tags: string[]
  link: string
  acceptanceRate?: string
  runtime: string
  memory: string
  language: string
  timestamp: string
  code: string
  status: string
  runtimePercentile?: string
  memoryPercentile?: string
  fileExtension?: string
}

export interface ProblemDetails {
  id: string
  title: string
  titleSlug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tags: string[]
  link: string
  acceptanceRate?: string
  content?: string
}

export interface GitHubConfig {
  username: string
  repository: string
  branch: string
  accessToken: string
  refreshToken?: string
  tokenExpiry?: number
}

export interface ExtensionConfig {
  github: GitHubConfig | null
  templates: {
    commitMessage: string
    readme: string
    folderLayout: string
  }
  settings: {
    includeProblemStatement: boolean
    sanitizeFilenames: boolean
    skipDuplicates: boolean
    autoRetry: boolean
    privateRepoWarning: boolean
    telemetry: boolean
  }
  version: number
}

export interface QueuedCommit {
  id: string
  submission: LeetCodeSubmission
  timestamp: number
  retryCount: number
  lastError?: string
}

export interface CommitPayload {
  path: string
  content: string
  message: string
  branch: string
  sha?: string
}

export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: string
  content: string
  encoding: string
}
