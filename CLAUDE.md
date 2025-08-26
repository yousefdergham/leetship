# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with hot reload and file watching
- `npm run build` - Build for development (TypeScript + Vite)
- `npm run type-check` - Run TypeScript type checking without emitting files

### Testing
- `npm test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with automatic fixes
- `npm run format` - Format code with Prettier

### Build & Distribution
- `npm run build:chrome` - Build and package Chrome extension (.zip)
- `npm run build:firefox` - Build and package Firefox extension (.xpi)
- `npm run build:all` - Build packages for both browsers
- `npm run clean` - Clean all build artifacts and packages

## Architecture Overview

LeetShip is a cross-browser extension (Chrome MV3/Firefox MV2) that automatically commits LeetCode submissions to GitHub. The architecture follows a modular design with clear separation between browser APIs, content scripts, and core business logic.

### Core Components

**Background Services:**
- `src/background/service-worker.ts` - Main background script (Chrome MV3)
- `src/background/firefox-background.js` - Firefox MV2 compatibility layer
- `src/background/commit-manager.ts` - Handles GitHub commit operations and queuing

**Content Scripts:**
- `src/content/leetcode.ts` - LeetCode page integration and submission detection

**UI Components:**
- `src/ui/onboarding.ts` - First-run setup wizard
- `src/ui/options.ts` - Extension settings and configuration

### Core Libraries (`src/lib/`)

**Authentication:**
- `auth/github.ts` - GitHub OAuth 2.0 with PKCE implementation

**API Integration:**
- `github/api.ts` - GitHub REST API client with token management
- `leetcode/api.ts` - LeetCode submission parsing and metadata extraction

**Storage & State:**
- `storage/index.ts` - Extension storage wrapper with encryption
- `types.ts` - TypeScript type definitions for the entire project

**Templating:**
- `templates/index.ts` - Commit message and README template engine

**Browser Compatibility:**
- `browser.ts` - Cross-browser API abstraction layer

### Build System

The project uses a custom build system (`scripts/build.js` and `scripts/dev.js`) that:
- Compiles TypeScript with Vite
- Creates browser-specific manifests (MV3 for Chrome, MV2 for Firefox)
- Handles cross-browser API differences
- Packages extensions for distribution

### Key Technical Details

**Cross-Browser Compatibility:**
- Uses `webextension-polyfill` for API standardization
- Separate manifest modifications for Chrome MV3 vs Firefox MV2
- Different background script implementations per browser

**Security Implementation:**
- OAuth 2.0 PKCE flow for GitHub authentication
- Secure token storage using browser extension APIs
- No hardcoded secrets or API keys

**File Organization:**
- TypeScript path aliases: `@/*` maps to `src/*`
- Test files alongside source code
- Browser-specific build outputs: `dist-chrome/` and `dist-firefox/`

### Development Workflow

1. **Setup**: Run `npm run dev` to start development server
2. **Loading**: Load `dist-chrome/` as unpacked extension in Chrome
3. **Testing**: Use `npm test` for unit tests, test on actual LeetCode submissions
4. **Building**: Use `npm run build:chrome` or `npm run build:firefox` for distribution

### Important Configuration Files

- `vite.config.ts` - Build configuration with multi-entry points
- `vitest.config.ts` - Test configuration with jsdom environment
- `tsconfig.json` - TypeScript configuration with path aliases
- `.eslintrc.json` - ESLint rules for TypeScript and web extensions