import { storage } from '../lib/storage'
import { githubAPI } from '../lib/github/api'
import { leetcodeAPI } from '../lib/leetcode/api'
import { TemplateEngine } from '../lib/templates'
import { QueuedCommit, LeetCodeSubmission, ProblemDetails } from '../lib/types'

export class CommitManager {
  async processCommit(queuedCommit: QueuedCommit): Promise<void> {
    const config = await storage.getDecryptedConfig()

    if (!config.github) {
      throw new Error('GitHub configuration not found')
    }

    const { submission } = queuedCommit
    const variables = TemplateEngine.getVariables(submission)

    const folderPath = TemplateEngine.generateFolderPath(config.templates.folderLayout, variables)

    const problemDetails = await this.getProblemDetails(submission.titleSlug)

    const files = await this.generateFiles(submission, problemDetails)

    const commitMessage = TemplateEngine.generateCommitMessage(
      config.templates.commitMessage,
      variables
    )

    const owner = config.github.username
    const repo = config.github.repository
    const branch = config.github.branch

    if (!repo) {
      throw new Error('No repository configured')
    }

    const results = []

    for (const file of files) {
      const fullPath = `${folderPath}/${file.name}`

      try {
        const result = await githubAPI.createOrUpdateFile(
          owner,
          repo,
          fullPath,
          file.content,
          commitMessage,
          branch
        )

        results.push(result)
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Failed to commit ${fullPath}:`, error)
        throw error
      }
    }

    await this.updateRepositoryReadme(owner, repo, branch, commitMessage)
  }

  private async getProblemDetails(titleSlug: string): Promise<ProblemDetails | undefined> {
    try {
      return await leetcodeAPI.getProblemDetails(titleSlug)
    } catch (error) {
      return undefined
    }
  }

  private async generateFiles(
    submission: LeetCodeSubmission,
    problemDetails?: ProblemDetails
  ): Promise<Array<{ name: string; content: string }>> {
    const config = await storage.getDecryptedConfig()
    const files: Array<{ name: string; content: string }> = []
    const variables = TemplateEngine.getVariables(submission, problemDetails)

    const filename = TemplateEngine.generateFilename(submission.language)
    files.push({
      name: filename,
      content: submission.code,
    })

    const problemStatement = config.settings.includeProblemStatement
      ? problemDetails?.content
      : undefined

    const readmeContent = TemplateEngine.generateReadme(
      config.templates.readme,
      variables,
      submission.code,
      problemStatement
    )

    files.push({
      name: 'README.md',
      content: readmeContent,
    })

    return files
  }

  private async updateRepositoryReadme(
    owner: string,
    repo: string,
    branch: string,
    _commitMessage: string
  ): Promise<void> {
    try {
      // const config = await storage.getDecryptedConfig()

      const existingReadme = await githubAPI.getFile(owner, repo, 'README.md', branch)

      let readmeContent = existingReadme
        ? atob(existingReadme.content)
        : this.generateInitialReadme()

      readmeContent = await this.updateReadmeWithNewSubmission(readmeContent, owner, repo, branch)

      await githubAPI.createOrUpdateFile(
        owner,
        repo,
        'README.md',
        readmeContent,
        `docs: update README with new submission`,
        branch
      )
    } catch (error) {
      console.error('Failed to update repository README:', error)
    }
  }

  private generateInitialReadme(): string {
    return `# LeetCode Solutions

This repository contains my LeetCode solutions, automatically synced by LeetShip.

## Statistics

| Difficulty | Count |
|------------|-------|
| Easy | 0 |
| Medium | 0 |
| Hard | 0 |
| **Total** | **0** |

## Latest Submissions

<!-- LeetShip:latest-submissions -->
<!-- /LeetShip:latest-submissions -->

## All Solutions

<!-- LeetShip:solutions-table -->
<!-- /LeetShip:solutions-table -->

---

*Generated with [LeetShip](https://github.com/leetship/extension) - Automatically commit your accepted LeetCode submissions to GitHub*
`
  }

  private async updateReadmeWithNewSubmission(
    readmeContent: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<string> {
    try {
      const solutions = await this.getAllSolutions(owner, repo, branch)
      const stats = this.calculateStats(solutions)
      const latestSubmissions = solutions
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 10)

      let updatedContent = readmeContent

      updatedContent = this.updateStatsSection(updatedContent, stats)
      updatedContent = this.updateLatestSubmissionsSection(updatedContent, latestSubmissions)
      updatedContent = this.updateSolutionsTable(updatedContent, solutions)

      return updatedContent
    } catch (error) {
      console.error('Failed to update README sections:', error)
      return readmeContent
    }
  }

  private async getAllSolutions(owner: string, repo: string, branch: string): Promise<any[]> {
    const solutions: any[] = []

    try {
      const difficulties = ['easy', 'medium', 'hard']

      for (const difficulty of difficulties) {
        try {
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${difficulty}?ref=${branch}`,
            {
              headers: await this.getGitHubHeaders(),
            }
          )

          if (response.ok) {
            const folders = await response.json()

            for (const folder of folders) {
              if (folder.type === 'dir') {
                const readmePath = `${difficulty}/${folder.name}/README.md`
                const readme = await githubAPI.getFile(owner, repo, readmePath, branch)

                if (readme) {
                  const content = atob(readme.content)
                  const frontMatter = this.parseFrontMatter(content)

                  if (frontMatter) {
                    solutions.push({
                      ...frontMatter,
                      difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
                      path: `${difficulty}/${folder.name}`,
                    })
                  }
                }
              }
            }
          }
        } catch (error) {}
      }
    } catch (error) {
      console.error('Failed to get all solutions:', error)
    }

    return solutions
  }

  private async getGitHubHeaders(): Promise<Record<string, string>> {
    const config = await storage.getDecryptedConfig()
    return {
      Authorization: `Bearer ${config.github?.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    }
  }

  private parseFrontMatter(content: string): any {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

    if (!frontMatterMatch) {
      return null
    }

    try {
      const frontMatterText = frontMatterMatch[1]
      const data: any = {}

      frontMatterText.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/)
        if (match) {
          const [, key, value] = match
          data[key] = value.replace(/^["']|["']$/g, '')
        }
      })

      return data
    } catch (error) {
      console.error('Failed to parse front matter:', error)
      return null
    }
  }

  private calculateStats(solutions: any[]): {
    easy: number
    medium: number
    hard: number
    total: number
  } {
    const stats = { easy: 0, medium: 0, hard: 0, total: 0 }

    solutions.forEach(solution => {
      const difficulty = solution.difficulty?.toLowerCase()
      if (difficulty === 'easy') stats.easy++
      else if (difficulty === 'medium') stats.medium++
      else if (difficulty === 'hard') stats.hard++
    })

    stats.total = stats.easy + stats.medium + stats.hard
    return stats
  }

  private updateStatsSection(content: string, stats: any): string {
    const statsTable = `| Difficulty | Count |
|------------|-------|
| Easy | ${stats.easy} |
| Medium | ${stats.medium} |
| Hard | ${stats.hard} |
| **Total** | **${stats.total}** |`

    return content.replace(
      /\| Difficulty \| Count \|[\s\S]*?\| \*\*Total\*\* \| \*\*\d+\*\* \|/,
      statsTable
    )
  }

  private updateLatestSubmissionsSection(content: string, latest: any[]): string {
    const latestList = latest
      .map(
        solution =>
          `- [${solution.title}](${solution.path}) - ${solution.difficulty} - ${solution.lang} - ${new Date(solution.submittedAt).toLocaleDateString()}`
      )
      .join('\n')

    return content.replace(
      /<!-- LeetShip:latest-submissions -->[\s\S]*?<!-- \/LeetShip:latest-submissions -->/,
      `<!-- LeetShip:latest-submissions -->\n${latestList}\n<!-- /LeetShip:latest-submissions -->`
    )
  }

  private updateSolutionsTable(content: string, solutions: any[]): string {
    const tableHeader = `| # | Title | Difficulty | Language | Runtime | Memory | Date |
|---|-------|------------|----------|---------|--------|------|`

    const tableRows = solutions
      .sort((a, b) => parseInt(a.id) - parseInt(b.id))
      .map(
        solution =>
          `| ${solution.id} | [${solution.title}](${solution.path}) | ${solution.difficulty} | ${solution.lang} | ${solution.runtime} | ${solution.memory} | ${new Date(solution.submittedAt).toLocaleDateString()} |`
      )
      .join('\n')

    const table = tableHeader + '\n' + tableRows

    return content.replace(
      /<!-- LeetShip:solutions-table -->[\s\S]*?<!-- \/LeetShip:solutions-table -->/,
      `<!-- LeetShip:solutions-table -->\n${table}\n<!-- /LeetShip:solutions-table -->`
    )
  }
}
