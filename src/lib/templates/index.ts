import { LeetCodeSubmission, ProblemDetails } from '../types'

export interface TemplateVariables {
  id: string
  title: string
  slug: string
  difficulty: string
  tags: string
  lang: string
  runtime: string
  memory: string
  timestamp: string
  link: string
  runtimePercentile?: string
  memoryPercentile?: string
}

export class TemplateEngine {
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase()
  }

  private static formatTags(tags: string[]): string {
    return tags.map(tag => tag.toLowerCase().replace(/\s+/g, '-')).join(', ')
  }

  private static formatDifficulty(difficulty: string): string {
    return difficulty.toLowerCase()
  }

  static getVariables(
    submission: LeetCodeSubmission,
    _problem?: ProblemDetails
  ): TemplateVariables {
    const paddedId = submission.id.padStart(4, '0')
    const sanitizedSlug = this.sanitizeFilename(submission.titleSlug)

    return {
      id: paddedId,
      title: submission.title,
      slug: sanitizedSlug,
      difficulty: this.formatDifficulty(submission.difficulty),
      tags: this.formatTags(submission.tags),
      lang: submission.language.toLowerCase(),
      runtime: submission.runtime,
      memory: submission.memory,
      timestamp: new Date(submission.timestamp).toISOString(),
      link: submission.link,
      runtimePercentile: submission.runtimePercentile,
      memoryPercentile: submission.memoryPercentile,
    }
  }

  static render(template: string, variables: TemplateVariables): string {
    let result = template

    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(pattern, value || '')
    })

    return result
  }

  static generateFolderPath(folderTemplate: string, variables: TemplateVariables): string {
    const path = this.render(folderTemplate, variables)
    return path.replace(/[<>:"/\\|?*]/g, '-').replace(/\/+/g, '/')
  }

  static generateFilename(language: string, attempt: number = 1): string {
    const extensions: { [key: string]: string } = {
      python: 'py',
      python3: 'py',
      java: 'java',
      javascript: 'js',
      typescript: 'ts',
      cpp: 'cpp',
      'c++': 'cpp',
      c: 'c',
      csharp: 'cs',
      'c#': 'cs',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      mysql: 'sql',
      postgresql: 'sql',
      oracle: 'sql',
    }

    const ext = extensions[language.toLowerCase()] || 'txt'
    const suffix = attempt > 1 ? `_${attempt}` : ''

    return `solution${suffix}.${ext}`
  }

  static generateReadme(
    template: string,
    variables: TemplateVariables,
    code: string,
    problemStatement?: string
  ): string {
    const codeBlock = this.generateCodeBlock(code, variables.lang)
    const frontMatter = this.generateFrontMatter(variables)

    let content = frontMatter + '\n\n' + this.render(template, variables)

    content += '\n\n## Solution\n\n' + codeBlock

    if (problemStatement) {
      content += '\n\n## Problem Statement\n\n' + problemStatement
    }

    return content
  }

  private static generateFrontMatter(variables: TemplateVariables): string {
    const tags = variables.tags
      .split(', ')
      .map(tag => `"${tag}"`)
      .join(', ')

    return `---
id: ${variables.id}
title: "${variables.title}"
slug: ${variables.slug}
difficulty: ${variables.difficulty}
tags: [${tags}]
lang: ${variables.lang}
runtime: "${variables.runtime}"
memory: "${variables.memory}"
submittedAt: "${variables.timestamp}"
link: "${variables.link}"${
      variables.runtimePercentile
        ? `
runtimePercentile: "${variables.runtimePercentile}"`
        : ''
    }${
      variables.memoryPercentile
        ? `
memoryPercentile: "${variables.memoryPercentile}"`
        : ''
    }
---`
  }

  private static generateCodeBlock(code: string, language: string): string {
    const langMap: { [key: string]: string } = {
      python: 'python',
      python3: 'python',
      java: 'java',
      javascript: 'javascript',
      typescript: 'typescript',
      cpp: 'cpp',
      'c++': 'cpp',
      c: 'c',
      csharp: 'csharp',
      'c#': 'csharp',
      go: 'go',
      rust: 'rust',
      ruby: 'ruby',
      php: 'php',
      swift: 'swift',
      kotlin: 'kotlin',
      scala: 'scala',
      mysql: 'sql',
      postgresql: 'sql',
      oracle: 'sql',
    }

    const lang = langMap[language.toLowerCase()] || language.toLowerCase()

    return '```' + lang + '\n' + code + '\n```'
  }

  static generateCommitMessage(template: string, variables: TemplateVariables): string {
    return this.render(template, variables)
  }
}
