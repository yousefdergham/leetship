# Changelog

All notable changes to LeetShip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project setup
- Cross-browser extension architecture
- GitHub OAuth authentication with PKCE
- LeetCode submission detection
- Automatic commit generation
- Template-based README generation
- Offline commit queuing
- Modern UI with dark mode support
- TypeScript support throughout
- Vite build system
- ESLint and Prettier configuration
- Comprehensive test suite
- Security-focused token management
- Cross-browser compatibility (Chrome MV3, Firefox)

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- Implemented secure token storage using browser APIs
- Added Fine-grained Personal Access Token authentication
- No client secrets stored in extension
- Minimal permission requirements

## [1.0.0] - 2024-01-XX

### Added

- Initial release of LeetShip
- Complete browser extension functionality
- GitHub integration for automatic commits
- LeetCode submission detection
- Template-based documentation generation
- Cross-browser support (Chrome and Firefox)
- Secure authentication system
- Offline support with commit queuing
- Modern user interface
- Comprehensive documentation

---

## Version History

- **1.0.0** - Initial release with core functionality
- **Unreleased** - Development version with latest features

## Contributing

When contributing to this project, please update this changelog by adding a new entry under the `[Unreleased]` section. Follow the existing format and include:

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for security-related changes

## Release Process

1. Update version in `package.json`
2. Update this changelog with release date
3. Create a new release tag
4. Update documentation if needed
5. Deploy to browser stores (when applicable)
