# Firefox Extension Signing Guide

## 🔐 Complete Guide to Sign Your LeetShip Extension for Firefox

Mozilla requires all Firefox extensions to be signed before they can be installed in Release and Beta versions of Firefox. This guide walks you through the entire process.

## 📋 Prerequisites

### 1. Install web-ext Tool
```bash
npm install -g web-ext
```

### 2. Build Your Extension
```bash
pnpm run build:firefox
```

## 🔑 Getting API Credentials

### Step 1: Create Mozilla Developer Account
1. Go to [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/)
2. Sign up for a developer account (free)
3. Complete your developer profile

### Step 2: Generate API Keys
1. Navigate to [API Key Management](https://addons.mozilla.org/en-US/developers/addon/api/key/)
2. Click **"Generate new credentials"**
3. Copy your **API Key** (JWT issuer) and **API Secret** (JWT secret)
4. **Important**: Store these securely - you won't see the secret again!

## 🚀 Signing Your Extension

### Method 1: Using Our Automated Script (Recommended)

#### Set Environment Variables:
```bash
export FIREFOX_API_KEY="your-jwt-issuer-here"
export FIREFOX_API_SECRET="your-jwt-secret-here"
```

#### Sign for Self-Distribution (Unlisted):
```bash
pnpm run sign:firefox
```

#### Sign for AMO Distribution (Listed):
```bash
pnpm run sign:firefox:listed
```

### Method 2: Manual Signing

#### Navigate to Firefox build directory:
```bash
cd dist-firefox
```

#### Sign for self-distribution:
```bash
web-ext sign \
  --api-key="your-jwt-issuer" \
  --api-secret="your-jwt-secret" \
  --channel=unlisted \
  --timeout=900000
```

#### Sign for AMO distribution:
```bash
web-ext sign \
  --api-key="your-jwt-issuer" \
  --api-secret="your-jwt-secret" \
  --channel=listed \
  --timeout=900000
```

## 📦 What Happens During Signing

1. **Upload**: Your extension is uploaded to Mozilla's servers
2. **Review**: Automated security and content policy checks
3. **Signing**: If approved, Mozilla signs your extension with their certificate
4. **Download**: The signed `.xpi` file is created in `web-ext-artifacts/`

### Typical Signing Time:
- **Automated Review**: 1-15 minutes for most extensions
- **Manual Review**: May take several days (for listed extensions)

## 📁 Finding Your Signed Extension

After successful signing, you'll find:
```
dist-firefox/
└── web-ext-artifacts/
    └── leetship-1.0.0.xpi  # Your signed extension
```

## 🔧 Installation Methods

### Option 1: Direct Installation (Self-Hosted)
1. Open Firefox
2. Go to `about:addons`
3. Click the gear icon (⚙️)
4. Select **"Install Add-on From File..."**
5. Choose your signed `.xpi` file

### Option 2: AMO Distribution
If you signed with `--channel=listed`, your extension will be available on the Mozilla Add-ons store after review.

## ⚠️ Troubleshooting

### Common Issues:

#### 1. API Credentials Error
```
Error: Invalid API key or secret
```
**Solution**: Double-check your API credentials and ensure they're correctly set as environment variables.

#### 2. Timeout Issues
```
Error: Signing timed out
```
**Solution**: The script sets a 15-minute timeout. If signing still fails, try again later as Mozilla's servers may be busy.

#### 3. Validation Errors
```
Error: Extension contains policy violations
```
**Solution**: Review Mozilla's [add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) and fix any issues.

#### 4. Missing Build
```
Error: Firefox build not found
```
**Solution**: Run `pnpm run build:firefox` first.

### Testing Unsigned Extensions (Development)
For testing purposes, you can use unsigned extensions in:
- **Firefox Developer Edition**
- **Firefox Nightly** 
- **Firefox ESR**

Set `xpinstall.signatures.required` to `false` in `about:config`.

## 📊 Signing Options Comparison

| Channel | Distribution | Review Time | Auto-Updates |
|---------|-------------|-------------|--------------|
| `unlisted` | Self-hosted | ~5-15 minutes | Manual | 
| `listed` | AMO Store | Several days | Automatic |

## 🔄 Re-signing for Updates

When you update your extension:

1. Update the version in `manifest.json`
2. Build the updated extension: `pnpm run build:firefox`
3. Sign again with the same process
4. Distribute the new signed `.xpi` file

## 📚 Additional Resources

- [Mozilla Extension Workshop](https://extensionworkshop.com/)
- [Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [web-ext Command Reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Extension Signing FAQ](https://wiki.mozilla.org/Add-ons/Extension_Signing)

## 🎯 Quick Start Commands

```bash
# Complete signing workflow
pnpm run build:firefox
export FIREFOX_API_KEY="your-key"
export FIREFOX_API_SECRET="your-secret"
pnpm run sign:firefox
```

Your signed extension will be ready for distribution! 🎉