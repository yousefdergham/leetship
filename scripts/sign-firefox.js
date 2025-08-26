#!/usr/bin/env node

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Script to sign Firefox extension for distribution
 * Usage: node scripts/sign-firefox.js [options]
 */

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function checkWebExt() {
  try {
    execSync('web-ext --version', { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

function getApiCredentials() {
  const apiKey = process.env.FIREFOX_API_KEY
  const apiSecret = process.env.FIREFOX_API_SECRET

  if (!apiKey || !apiSecret) {
    log('\n❌ Missing Firefox API credentials!', 'red')
    log('\nPlease set environment variables:', 'yellow')
    log('export FIREFOX_API_KEY="your-jwt-issuer"', 'cyan')
    log('export FIREFOX_API_SECRET="your-jwt-secret"', 'cyan')
    log('\nGet credentials from: https://addons.mozilla.org/en-US/developers/addon/api/key/', 'blue')
    process.exit(1)
  }

  return { apiKey, apiSecret }
}

async function syncSystemTime() {
  log('🕐 Synchronizing system time...', 'yellow')

  try {
    // Try to sync with NTP servers
    execSync('sudo timedatectl set-ntp true', { stdio: 'ignore' })
    execSync('sudo systemctl restart systemd-timesyncd', { stdio: 'ignore' })

    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check current time
    const currentTime = execSync('date', { encoding: 'utf8' }).trim()
    log(`✅ System time synchronized: ${currentTime}`, 'green')

    return true
  } catch (error) {
    log('⚠️ Could not sync system time automatically', 'yellow')
    log('Please ensure your system clock is accurate', 'yellow')
    return false
  }
}

async function tryAlternativeSigning(apiKey, apiSecret, channel) {
  log('🔄 Trying alternative signing approach...', 'yellow')

  try {
    // Try with different timeout and no approval wait
    const signCommand = [
      'web-ext sign',
      `--api-key="${apiKey}"`,
      `--api-secret="${apiSecret}"`,
      `--channel=${channel}`,
      '--timeout=300000', // 5 minutes
      '--approval-timeout=0' // Don't wait for approval
    ].join(' ')

    execSync(signCommand, { stdio: 'inherit' })
    return true
  } catch (error) {
    log('❌ Alternative signing failed', 'red')
    return false
  }
}

async function main() {
  log('🦊 Firefox Extension Signing Script', 'blue')
  log('=====================================\n', 'blue')

  // Check if web-ext is installed
  if (!checkWebExt()) {
    log('❌ web-ext is not installed', 'red')
    log('Install it with: pnpm add -g web-ext', 'yellow')
    process.exit(1)
  }

  // Get API credentials
  const { apiKey, apiSecret } = getApiCredentials()

  // Check if Firefox build exists
  const firefoxDistPath = path.join(__dirname, '..', 'dist-firefox')
  if (!fs.existsSync(firefoxDistPath)) {
    log('❌ Firefox build not found', 'red')
    log('Run: pnpm run build:firefox', 'yellow')
    process.exit(1)
  }

  // Determine signing channel
  const args = process.argv.slice(2)
  const channel = args.includes('--listed') ? 'listed' : 'unlisted'

  log(`📦 Signing extension for ${channel} distribution...`, 'cyan')

  // Try to sync system time first
  await syncSystemTime()

  try {
    // Change to Firefox dist directory
    process.chdir(firefoxDistPath)

    // Build signing command
    const signCommand = [
      'web-ext sign',
      `--api-key="${apiKey}"`,
      `--api-secret="${apiSecret}"`,
      `--channel=${channel}`,
      '--timeout=900000' // 15 minutes timeout
    ].join(' ')

    log('🔄 Executing signing...', 'yellow')

    // Execute signing
    execSync(signCommand, { stdio: 'inherit' })

    log('\n✅ Extension signed successfully!', 'green')
    log('\n📁 Signed extension location:', 'cyan')
    log(`   ${path.join(firefoxDistPath, 'web-ext-artifacts')}`, 'cyan')

    // List generated files
    const artifactsPath = path.join(firefoxDistPath, 'web-ext-artifacts')
    if (fs.existsSync(artifactsPath)) {
      const files = fs.readdirSync(artifactsPath)
      log('\n📄 Generated files:', 'cyan')
      files.forEach(file => {
        log(`   - ${file}`, 'green')
      })
    }

    log('\n🚀 Installation instructions:', 'blue')
    log('   1. Open Firefox', 'cyan')
    log('   2. Go to about:addons', 'cyan')
    log('   3. Click gear icon → Install Add-on From File', 'cyan')
    log('   4. Select the .xpi file from web-ext-artifacts/', 'cyan')

  } catch (error) {
    log('\n❌ Primary signing failed!', 'red')
    log(error.message, 'red')

    // Try alternative approach
    log('\n🔄 Attempting alternative signing method...', 'yellow')
    const alternativeSuccess = await tryAlternativeSigning(apiKey, apiSecret, channel)

    if (!alternativeSuccess) {
      log('\n❌ All signing attempts failed!', 'red')
      log('\n🔧 Troubleshooting suggestions:', 'yellow')
      log('   1. Check your system clock is accurate', 'cyan')
      log('   2. Ensure your API credentials are correct', 'cyan')
      log('   3. Try again in a few minutes', 'cyan')
      log('   4. Use the web interface at Mozilla Developer Hub', 'cyan')
      log('   5. For development, use Firefox Developer Edition', 'cyan')
      process.exit(1)
    }
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('🦊 Firefox Extension Signing Script', 'blue')
  log('====================================\n', 'blue')
  log('Usage:', 'cyan')
  log('  node scripts/sign-firefox.js              # Sign for self-distribution (unlisted)', 'yellow')
  log('  node scripts/sign-firefox.js --listed     # Sign for AMO distribution (listed)', 'yellow')
  log('\nEnvironment Variables Required:', 'cyan')
  log('  FIREFOX_API_KEY      JWT issuer from AMO', 'yellow')
  log('  FIREFOX_API_SECRET   JWT secret from AMO', 'yellow')
  log('\nGet API keys from:', 'cyan')
  log('  https://addons.mozilla.org/en-US/developers/addon/api/key/', 'blue')
  process.exit(0)
}

main()