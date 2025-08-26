// Language mapping for LeetCode submissions
// Based on LeetHub extension's comprehensive mapping

export const LANGUAGE_EXTENSIONS = {
  C: '.c',
  'C++': '.cpp',
  'C#': '.cs',
  Bash: '.sh',
  Dart: '.dart',
  Elixir: '.ex',
  Erlang: '.erl',
  Go: '.go',
  Java: '.java',
  JavaScript: '.js',
  Javascript: '.js',
  Kotlin: '.kt',
  MySQL: '.sql',
  'MS SQL Server': '.sql',
  Oracle: '.sql',
  PHP: '.php',
  Pandas: '.py',
  PostgreSQL: '.sql',
  Python: '.py',
  Python3: '.py',
  Racket: '.rkt',
  Ruby: '.rb',
  Rust: '.rs',
  Scala: '.scala',
  Swift: '.swift',
  TypeScript: '.ts',
} as const

export type Language = keyof typeof LANGUAGE_EXTENSIONS
export type FileExtension = (typeof LANGUAGE_EXTENSIONS)[Language]

export function getLanguageExtension(language: string): FileExtension | null {
  if (!language) return null

  // Normalize language name
  const normalizedLanguage = language.trim()

  // Direct match
  if (LANGUAGE_EXTENSIONS[normalizedLanguage as Language]) {
    return LANGUAGE_EXTENSIONS[normalizedLanguage as Language]
  }

  // Case-insensitive match
  const lowerLanguage = normalizedLanguage.toLowerCase()
  for (const [lang, ext] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (lang.toLowerCase() === lowerLanguage) {
      return ext
    }
  }

  // Common variations
  const variations: Record<string, FileExtension> = {
    js: '.js',
    javascript: '.js',
    python: '.py',
    python3: '.py',
    cpp: '.cpp',
    'c++': '.cpp',
    'c#': '.cs',
    csharp: '.cs',
    java: '.java',
    typescript: '.ts',
    ts: '.ts',
    rust: '.rs',
    go: '.go',
    swift: '.swift',
    kotlin: '.kt',
    scala: '.scala',
    php: '.php',
    ruby: '.rb',
    dart: '.dart',
    elixir: '.ex',
    erlang: '.erl',
    racket: '.rkt',
    bash: '.sh',
    shell: '.sh',
    sql: '.sql',
    mysql: '.sql',
    postgresql: '.sql',
    oracle: '.sql',
    'ms sql server': '.sql',
    pandas: '.py',
  }

  return variations[lowerLanguage] || null
}

export function getLanguageFromExtension(extension: string): Language | null {
  if (!extension) return null

  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`

  for (const [language, ext] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (ext === normalizedExtension) {
      return language as Language
    }
  }

  return null
}

export function getDisplayName(language: string): string {
  const ext = getLanguageExtension(language)
  if (!ext) return language

  // Return the canonical name
  for (const [lang, extension] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extension === ext) {
      return lang
    }
  }

  return language
}
