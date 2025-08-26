import { LeetCodeSubmission, ProblemDetails } from '../types'

const LEETCODE_BASE_URL = 'https://leetcode.com'
const GRAPHQL_ENDPOINT = `${LEETCODE_BASE_URL}/graphql`

export interface LeetCodeAPI {
  getRecentSubmissions(limit?: number): Promise<any[]>
  getSubmissionDetails(submissionId: string): Promise<any>
  getProblemDetails(titleSlug: string): Promise<ProblemDetails>
  getSubmissionCode(submissionId: string): Promise<string>
}

export class LeetCodeAPIImpl implements LeetCodeAPI {
  private async makeGraphQLRequest(query: string, variables: any = {}): Promise<any> {
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
      }

      return data.data
    } catch (error) {
      console.error('GraphQL request failed:', error)
      throw error
    }
  }

  async getRecentSubmissions(limit: number = 20): Promise<any[]> {
    const query = `
      query recentSubmissionList($offset: Int!, $limit: Int!) {
        recentSubmissionList(offset: $offset, limit: $limit) {
          id
          title
          titleSlug
          timestamp
          statusDisplay
          lang
          runtime
          memory
          runtimePercentile
          memoryPercentile
          url
        }
      }
    `

    const variables = { offset: 0, limit }
    const data = await this.makeGraphQLRequest(query, variables)
    return data.recentSubmissionList || []
  }

  async getSubmissionDetails(submissionId: string): Promise<any> {
    const query = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          id
          code
          runtime
          memory
          runtimePercentile
          memoryPercentile
          statusDisplay
          timestamp
          question {
            questionId
            title
            titleSlug
            difficulty
            topicTags {
              name
              slug
            }
            acRate
            content
          }
          lang {
            name
            verboseName
          }
        }
      }
    `

    const variables = { submissionId: parseInt(submissionId) }
    const data = await this.makeGraphQLRequest(query, variables)
    return data.submissionDetails
  }

  async getProblemDetails(titleSlug: string): Promise<ProblemDetails> {
    const query = `
      query questionDetails($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          title
          titleSlug
          difficulty
          content
          topicTags {
            name
            slug
          }
          acRate
        }
      }
    `

    const variables = { titleSlug }
    const data = await this.makeGraphQLRequest(query, variables)
    const question = data.question

    if (!question) {
      throw new Error(`Problem not found: ${titleSlug}`)
    }

    return {
      id: question.questionId,
      title: question.title,
      titleSlug: question.titleSlug,
      difficulty: question.difficulty,
      tags: question.topicTags.map((tag: any) => tag.name),
      link: `${LEETCODE_BASE_URL}/problems/${question.titleSlug}/`,
      acceptanceRate: question.acRate ? `${Math.round(question.acRate * 100)}%` : undefined,
      content: question.content,
    }
  }

  async getSubmissionCode(submissionId: string): Promise<string> {
    const details = await this.getSubmissionDetails(submissionId)
    return details.code || ''
  }

  async parseSubmissionFromDetails(details: any): Promise<LeetCodeSubmission> {
    const question = details.question

    return {
      id: question.questionId,
      title: question.title,
      titleSlug: question.titleSlug,
      difficulty: question.difficulty,
      tags: question.topicTags.map((tag: any) => tag.name),
      link: `${LEETCODE_BASE_URL}/problems/${question.titleSlug}/`,
      acceptanceRate: question.acRate ? `${Math.round(question.acRate * 100)}%` : undefined,
      runtime: details.runtime || 'N/A',
      memory: details.memory || 'N/A',
      language: details.lang?.verboseName || details.lang?.name || 'Unknown',
      timestamp: new Date(details.timestamp * 1000).toISOString(),
      code: details.code || '',
      status: details.statusDisplay || 'Unknown',
      runtimePercentile: details.runtimePercentile
        ? `${Math.round(details.runtimePercentile)}%`
        : undefined,
      memoryPercentile: details.memoryPercentile
        ? `${Math.round(details.memoryPercentile)}%`
        : undefined,
    }
  }
}

export class LeetCodeContentScriptAPI implements LeetCodeAPI {
  async getRecentSubmissions(_limit?: number): Promise<any[]> {
    throw new Error('Not implemented in content script context')
  }

  async getSubmissionDetails(_submissionId: string): Promise<any> {
    throw new Error('Use network request interception instead')
  }

  async getProblemDetails(titleSlug: string): Promise<ProblemDetails> {
    const api = new LeetCodeAPIImpl()
    return await api.getProblemDetails(titleSlug)
  }

  async getSubmissionCode(_submissionId: string): Promise<string> {
    throw new Error('Use network request interception instead')
  }

  parseSubmissionFromPage(): LeetCodeSubmission | null {
    try {
      const problemTitle = document.querySelector('[data-cy="question-title"]')?.textContent?.trim()

      if (!problemTitle) {return null
      }

      const currentUrl = window.location.href
      const titleSlugMatch = currentUrl.match(/\/problems\/([^\/]+)/)

      if (!titleSlugMatch) {return null
      }

      const titleSlug = titleSlugMatch[1]

      return {
        id: '0',
        title: problemTitle,
        titleSlug,
        difficulty: 'Medium',
        tags: [],
        link: `https://leetcode.com/problems/${titleSlug}/`,
        runtime: 'N/A',
        memory: 'N/A',
        language: 'Unknown',
        timestamp: new Date().toISOString(),
        code: '',
        status: 'Accepted',
      }
    } catch (error) {
      console.error('Failed to parse submission from page:', error)
      return null
    }
  }

  async extractSubmissionFromResponse(
    responseText: string,
    submissionId?: string
  ): Promise<LeetCodeSubmission | null> {
    try {
      const response = JSON.parse(responseText)

      if (response.data?.submissionDetails) {
        const details = response.data.submissionDetails
        const api = new LeetCodeAPIImpl()
        const result = await api.parseSubmissionFromDetails(details)
        return result as LeetCodeSubmission
      }

      if (response.data?.recentSubmissionList) {
        const submissions = response.data.recentSubmissionList
        const latest = submissionId
          ? submissions.find((s: any) => s.id === submissionId)
          : submissions[0]

        if (latest && latest.statusDisplay === 'Accepted') {
          return {
            id: latest.id,
            title: latest.title,
            titleSlug: latest.titleSlug,
            difficulty: 'Medium',
            tags: [],
            link: `https://leetcode.com/problems/${latest.titleSlug}/`,
            runtime: latest.runtime || 'N/A',
            memory: latest.memory || 'N/A',
            language: latest.lang || 'Unknown',
            timestamp: new Date(latest.timestamp * 1000).toISOString(),
            code: '',
            status: latest.statusDisplay,
            runtimePercentile: latest.runtimePercentile
              ? `${Math.round(latest.runtimePercentile)}%`
              : undefined,
            memoryPercentile: latest.memoryPercentile
              ? `${Math.round(latest.memoryPercentile)}%`
              : undefined,
          }
        }
      }

      return null
    } catch (error) {
      console.error('Failed to extract submission from response:', error)
      return null
    }
  }
}

export const leetcodeAPI = new LeetCodeAPIImpl()
export const leetcodeContentAPI = new LeetCodeContentScriptAPI()
