# Contributing to LeetShip 🤝

Thank you for your interest in contributing to LeetShip! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/leetShip.git
   cd leetShip
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes**
6. **Test your changes**
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```
7. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```
8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
9. **Create a Pull Request**

## 📋 Development Setup

### Prerequisites

- Node.js 18+ and npm
- Modern browser (Chrome 88+ or Firefox 88+)
- Git for version control

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for development
npm run build

# Build packaged extensions
npm run build:all

# Code quality checks
npm run lint
npm run lint:fix
npm run type-check
npm run format

# Testing
npm test
npm run test:watch
npm run test:coverage

# Clean build artifacts
npm run clean
```

### Loading the Extension

**Chrome:**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist-chrome/` directory

**Firefox:**

1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `dist-firefox/manifest.json`

## 🎯 Areas for Contribution

### High Priority

- **Bug fixes** - Any issues reported in the GitHub issues
- **Documentation** - Improving README, code comments, and guides
- **Testing** - Adding test coverage for existing functionality

### Medium Priority

- **UI/UX improvements** - Better user interface and experience
- **Performance optimizations** - Faster builds, better runtime performance
- **Code quality** - Refactoring, better error handling, code organization

### Low Priority

- **New features** - Additional functionality (discuss in issues first)
- **Language support** - Support for additional programming languages
- **Platform support** - Support for additional browsers

## 📝 Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types for object shapes
- Use strict type checking
- Add JSDoc comments for public APIs

### Code Formatting

- Use Prettier for code formatting
- Use ESLint for code linting
- Follow the existing code style in the project

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(auth): add GitHub OAuth authentication
fix(leetcode): handle submission detection edge case
docs(readme): update installation instructions
```

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for all new functionality
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (GitHub API, LeetCode API)

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('when condition is met', () => {
    it('should behave as expected', () => {
      // Test implementation
    })
  })

  describe('when condition is not met', () => {
    it('should handle error gracefully', () => {
      // Test implementation
    })
  })
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/lib/auth/github.test.ts
```

## 🔍 Debugging

### Extension Debugging

1. **Chrome**: Go to `chrome://extensions/`, find LeetShip, click "Inspect views: service worker"
2. **Firefox**: Go to `about:debugging`, find LeetShip, click "Inspect"

### Common Issues

- **Build errors**: Check TypeScript errors with `npm run type-check`
- **Linting errors**: Fix with `npm run lint:fix`
- **Test failures**: Check test output for specific error messages
- **Extension not loading**: Check browser console for errors
- **GitHub authentication**: Ensure Personal Access Token has correct permissions

## 📋 Pull Request Guidelines

### Before Submitting

1. **Test your changes** thoroughly
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Check code quality** with linting and type checking
5. **Update CHANGELOG.md** if adding new features

### Pull Request Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Test addition/update

## Testing

- [ ] All tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors or warnings
```

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
## Bug Description

Clear description of the bug

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior

What you expected to happen

## Actual Behavior

What actually happened

## Environment

- Browser: [e.g. Chrome 120, Firefox 121]
- Extension Version: [e.g. 1.0.0]
- OS: [e.g. Windows 11, macOS 14, Ubuntu 22.04]

## Additional Information

Screenshots, console logs, or other relevant information
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description

Clear description of the feature

## Use Case

Why this feature would be useful

## Proposed Implementation

Optional: How you think this could be implemented

## Alternatives Considered

Optional: Other approaches you've considered
```

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Ask questions in pull request comments

## 🎉 Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to LeetShip! 🚀
