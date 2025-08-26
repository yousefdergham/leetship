# LeetShip 🚀

> **Automatically commit your accepted LeetCode submissions to GitHub**

LeetShip is a cross-browser extension that detects when you submit an accepted solution on LeetCode and automatically commits it to your GitHub repository with clean structure, generated README files, and organized folders.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-orange)](https://chrome.google.com/webstore)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-coming%20soon-orange)](https://addons.mozilla.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-purple.svg)](https://vitejs.dev/)

## ✨ Features

- **🚀 Automatic Detection**: Detects accepted submissions in real-time
- **📁 Clean Organization**: Structures solutions by difficulty (`easy/0001-two-sum/`)
- **📋 Generated READMEs**: Creates detailed documentation with problem metadata
- **🔒 Secure Authentication**: GitHub OAuth with PKCE for secure access
- **🌐 Cross-Browser**: Works on Chrome (MV3) and Firefox
- **⚡ Offline Support**: Queues commits when offline and retries automatically
- **🎨 Modern UI**: Beautiful options page with dark mode support
- **🛡️ Privacy-First**: No telemetry, your code stays private

## 🚀 Quick Start

### For Users

1. **Download the Extension**
   - Chrome: Download from Chrome Web Store (coming soon)
   - Firefox: Download from Firefox Add-ons (coming soon)

2. **Setup**
   - Click the LeetShip icon and follow the onboarding wizard
   - Add your GitHub Personal Access Token
   - Select or create a repository for your solutions
   - Configure your preferences

3. **Start Coding**
   - Visit LeetCode and solve problems as usual
   - LeetShip automatically detects accepted submissions
   - Check your GitHub repository to see your solutions!

### For Developers

```bash
# Clone & Install
git clone https://github.com/yousefdergham/leetShip.git
cd leetShip
npm install

# Development
npm run dev          # Start development server
npm run build        # Build for development
npm run build:all    # Build packaged extensions

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run tests
```

## 📁 Repository Structure

LeetShip creates a clean, organized structure in your GitHub repository:

```
my-leetcode-solutions/
├── README.md              # Auto-updated with statistics
├── easy/
│   ├── 0001-two-sum/
│   │   ├── solution.py
│   │   └── README.md
│   └── 0026-remove-duplicates/
│       ├── solution.java
│       └── README.md
├── medium/
│   └── 0002-add-two-numbers/
│       ├── solution.cpp
│       └── README.md
└── hard/
    └── 0004-median-of-two-sorted-arrays/
        ├── solution.js
        └── README.md
```

## 🏗️ Architecture

```
src/
├── background/          # Service worker for submission detection
├── content/             # Content scripts for LeetCode integration
├── ui/                  # User interface components
├── lib/                 # Core libraries
│   ├── auth/           # GitHub authentication
│   ├── github/         # GitHub API client
│   ├── leetcode/       # LeetCode API integration
│   ├── storage/        # Extension storage management
│   └── templates/      # README and commit templating
├── styles/             # CSS stylesheets
└── tests/              # Test files
```

## ⚙️ Configuration

### Templates

Customize how your commits and READMEs are generated:

**Commit Message Template:**

```
feat(leetcode): AC {{id}}. {{title}} [{{difficulty}}] ({{lang}}) — runtime: {{runtime}}, memory: {{memory}}
```

**Available Variables:**

- `{{id}}` - Zero-padded problem ID (e.g., "0001")
- `{{title}}` - Problem title
- `{{difficulty}}` - Problem difficulty (easy/medium/hard)
- `{{lang}}` - Programming language
- `{{runtime}}` - Your solution's runtime
- `{{memory}}` - Your solution's memory usage
- `{{link}}` - LeetCode problem URL

## 🔒 Security & Privacy

- **Fine-grained Personal Access Tokens** for secure GitHub authentication
- **Minimal permissions** - only repository access you grant
- **Encrypted token storage** using browser secure storage APIs
- **No telemetry by default** - you control what data is sent
- **Local processing** - your code is processed locally before GitHub

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- 🌐 Additional language support for syntax highlighting
- 🔍 Enhanced LeetCode problem detection
- 📊 Statistics and analytics features
- 🎨 UI/UX improvements
- 🧪 Additional test coverage
- 📚 Documentation improvements

## 📄 Legal Notes

### LeetCode Terms of Service

By default, LeetShip **does not include full problem statements** in your GitHub commits to respect LeetCode's Terms of Service. The extension only includes:

- Problem title and metadata
- Link to the original problem
- Your solution code
- Your performance statistics

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Disclaimer

LeetShip is not affiliated with LeetCode or GitHub. This is an independent project designed to help developers organize their coding practice.

## 📊 Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox Add-ons publication
- [ ] GitHub repository creation from extension
- [ ] Advanced statistics and progress tracking
- [ ] Multiple repository support
- [ ] Team/organization repository support
- [ ] Export functionality (JSON, CSV)
- [ ] Problem difficulty progression analytics
- [ ] Integration with other coding platforms

## 👨‍💻 Creator

**LeetShip** is created by **[Yousef Dergham](https://github.com/yousefdergham/)**

- 🌐 **Portfolio**: [yousefdergham.vercel.app](https://yousefdergham.vercel.app/)
- 💼 **LinkedIn**: [linkedin.com/in/yousefdergham](https://www.linkedin.com/in/yousefdergham/)
- 🐙 **GitHub**: [github.com/yousefdergham](https://github.com/yousefdergham/)

---

**Made with ❤️ by [Yousef Dergham](https://github.com/yousefdergham/)**

_Automatically sync your coding journey from LeetCode to GitHub_
