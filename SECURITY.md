# Security Policy

## 🔒 Security Overview

LeetShip takes security seriously and implements multiple layers of protection to keep your code, credentials, and personal information safe. This document outlines our security practices and how to report security issues.

## 🛡️ Security Features

### GitHub Authentication

- **OAuth 2.0 with PKCE**: Industry-standard secure authentication flow
- **No Client Secrets**: Extension contains no hardcoded secrets that could be compromised
- **Minimal Permissions**: Only requests access to repositories you explicitly grant
- **Token Encryption**: All stored tokens are encrypted using browser's secure storage APIs
- **Automatic Refresh**: Handles token expiration gracefully without user intervention

### Data Protection

- **Local Processing**: Your code is processed locally before transmission to GitHub
- **HTTPS Only**: All network requests use encrypted connections
- **No External Tracking**: No analytics or telemetry sent to third parties by default
- **Secure Storage**: All configuration data stored using browser's encrypted extension storage

### Privacy by Design

- **Minimal Data Collection**: Only collects necessary problem metadata and solution code
- **No Problem Statements**: Excludes full problem descriptions by default to respect LeetCode ToS
- **User Control**: Full transparency and control over what data is committed and when
- **Optional Telemetry**: Anonymous error reporting is opt-in only

## 🔍 Supported Versions

We provide security updates for the following versions:

| Version | Supported                |
| ------- | ------------------------ |
| 1.x.x   | ✅ Yes                   |
| 0.x.x   | ❌ No (Development only) |

## 🚨 Reporting Security Issues

**Please DO NOT report security vulnerabilities using public GitHub issues.**

### How to Report

For security vulnerabilities, please email: **security@LeetShip.dev**

Include the following information:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if known)

### What to Expect

1. **Acknowledgment**: We'll acknowledge your report within 24 hours
2. **Initial Assessment**: We'll provide an initial assessment within 72 hours
3. **Investigation**: We'll investigate and work on a fix
4. **Resolution**: We'll release a patch and notify you when it's available
5. **Credit**: With your permission, we'll credit you in the security advisory

### Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Don't access or modify data that doesn't belong to you
- Don't perform actions that could harm our users or service
- Don't use social engineering tactics against our team

## 🔐 Security Best Practices for Users

### Account Security

- Use strong, unique passwords for your GitHub account
- Enable two-factor authentication (2FA) on GitHub
- Regularly review your GitHub authorized applications
- Monitor your repositories for unexpected commits

### Extension Security

- Only install LeetShip from official browser stores
- Keep the extension updated to the latest version
- Review permissions requested by the extension
- Report any suspicious behavior immediately

### Repository Security

- Consider using private repositories for your solutions
- Be aware that premium LeetCode problems may have intellectual property restrictions
- Don't include sensitive information in commit messages or code comments
- Regularly review your commit history

## 🛠️ Technical Security Details

### Authentication Flow

1. User initiates GitHub connection
2. Extension generates PKCE code verifier and challenge
3. User is redirected to GitHub OAuth authorization page
4. GitHub redirects back with authorization code
5. Extension exchanges code for access token using PKCE
6. Token is encrypted and stored locally
7. Subsequent API calls use the stored token

### Data Encryption

- **Storage**: All sensitive data is encrypted using AES-256
- **Transmission**: TLS 1.2+ for all network communications
- **Memory**: Sensitive data cleared from memory after use

### Permission Model

- **Host Permissions**: Limited to LeetCode.com and GitHub API domains
- **Storage**: Local storage only, no cloud synchronization
- **Identity**: Only for GitHub OAuth authentication
- **Active Tab**: Limited to detecting LeetCode submissions

### Code Security

- **TypeScript**: Strong typing helps prevent common vulnerabilities
- **ESLint**: Security-focused linting rules to catch potential issues
- **Content Security Policy**: Strict CSP in manifest to prevent code injection
- **Input Validation**: All user inputs are validated and sanitized

## 🔄 Security Update Process

### Automatic Updates

- Security patches are delivered via browser extension auto-update
- Critical security updates are prioritized and released immediately
- Users are notified of security updates through extension notifications

### Manual Actions

In rare cases where user action is required:

- We'll display prominent notices in the extension UI
- Email notifications to users who have opted in
- Clear instructions on required actions

## 📋 Security Checklist for Developers

When contributing to LeetShip:

- [ ] No hardcoded secrets or credentials
- [ ] All user inputs are validated and sanitized
- [ ] Sensitive data is properly encrypted before storage
- [ ] Network requests use HTTPS only
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are kept up to date
- [ ] Security testing is performed before releases

## 🏷️ Security Headers and Policies

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src https://api.github.com https://github.com https://leetcode.com;
```

### Permissions (Manifest V3)

```json
{
  "permissions": ["storage", "identity", "activeTab", "background", "notifications"],
  "host_permissions": ["https://leetcode.com/*", "https://api.github.com/*", "https://github.com/*"]
}
```

## 🔍 Security Auditing

### Internal Auditing

- Regular code reviews with security focus
- Automated dependency vulnerability scanning
- Static code analysis for security issues
- Penetration testing of authentication flows

### External Auditing

- We welcome security researchers to review our code
- Bug bounty program details (if applicable) will be published separately
- Regular third-party security assessments

## ⚠️ Known Limitations

### Browser Security Model

- Extension runs with browser extension privileges
- Limited by browser's extension security policies
- Cannot access data from other extensions or browser internals

### LeetCode Integration

- Relies on LeetCode's UI structure which may change
- Cannot access LeetCode's internal APIs or authentication
- Limited to publicly available submission data

### GitHub Integration

- Dependent on GitHub's API and OAuth implementation
- Subject to GitHub's rate limiting and security policies
- Cannot access repositories without explicit user permission

## 📞 Contact Information

For security-related inquiries:

- **Email**: security@LeetShip.dev
- **PGP Key**: Available upon request
- **Response Time**: 24-72 hours for initial response

For general questions:

- **GitHub Issues**: Non-security bugs and feature requests
- **Discussions**: General questions and community support

## 📄 Compliance

LeetShip follows:

- **OWASP Top 10**: Web application security best practices
- **Browser Store Policies**: Chrome Web Store and Firefox Add-on security requirements
- **OAuth 2.0 Security BCP**: RFC 8252 best practices for OAuth in native apps
- **GDPR Principles**: Privacy by design and minimal data collection

---

**Last Updated**: January 2024

This security policy is reviewed and updated regularly. Users will be notified of significant changes through extension updates and release notes.
