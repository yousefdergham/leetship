#!/usr/bin/env node

import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { watch } from 'chokidar'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildForBrowser } from './build.js'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

let buildProcess = null
let isBuilding = false

async function startViteBuild() {
  console.log('🔄 Starting Vite build in watch mode...')
  
  return new Promise((resolve, reject) => {
    buildProcess = spawn('npx', ['vite', 'build', '--mode', 'development', '--watch'], {
      cwd: rootDir,
      stdio: 'pipe',
    })

    buildProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log(output.trim())
      
      if (output.includes('built in')) {
        console.log('✅ Vite build completed')
        if (!isBuilding) {
          rebuildExtensions()
        }
      }
    })

    buildProcess.stderr.on('data', (data) => {
      const error = data.toString()
      if (!error.includes('watching for file changes')) {
        console.error('Vite error:', error.trim())
      }
    })

    buildProcess.on('close', (code) => {
      console.log(`Vite build process exited with code ${code}`)
      buildProcess = null
    })

    buildProcess.on('error', (error) => {
      console.error('Failed to start Vite build:', error)
      reject(error)
    })

    // Resolve after a short delay to ensure process is running
    setTimeout(resolve, 1000)
  })
}

async function rebuildExtensions() {
  if (isBuilding) return
  
  isBuilding = true
  console.log('\n🔄 Rebuilding extensions...')
  
  try {
    // Only rebuild Chrome version in development for speed
    await buildForBrowser('chrome')
    console.log('✅ Extension rebuilt for Chrome')
    console.log('💡 Load dist-chrome/ in Chrome to test')
    
  } catch (error) {
    console.error('❌ Extension rebuild failed:', error.message)
  } finally {
    isBuilding = false
  }
}

function setupFileWatcher() {
  console.log('👀 Setting up file watcher...')
  
  const watcher = watch([
    'public/**/*',
    'src/**/*.ts',
    'src/**/*.html',
    'src/**/*.css',
  ], {
    ignored: ['node_modules', 'dist*', '*.test.ts'],
    persistent: true,
    cwd: rootDir,
  })

  watcher.on('change', (path) => {
    console.log(`📝 File changed: ${path}`)
  })

  watcher.on('add', (path) => {
    console.log(`➕ File added: ${path}`)
  })

  watcher.on('unlink', (path) => {
    console.log(`➖ File removed: ${path}`)
  })

  return watcher
}

function setupExtensionReloader() {
  console.log('🔄 Extension auto-reload enabled')
  console.log('💡 Install Extension Reloader extension for automatic reloading in Chrome')
  
  // In a production setup, you might implement a WebSocket server here
  // to automatically reload the extension when files change
}

async function main() {
  try {
    console.log('🚀 Starting LeetShip development server...')
    console.log('📁 Working directory:', rootDir)
    
    // Initial build
    console.log('\n📦 Running initial build...')
    await execAsync('npm run build')
    await rebuildExtensions()
    
    // Start Vite in watch mode
    await startViteBuild()
    
    // Setup file watching
    const watcher = setupFileWatcher()
    setupExtensionReloader()
    
    console.log('\n🎉 Development server started!')
    console.log('\n📋 Development workflow:')
    console.log('   1. Load dist-chrome/ in Chrome (chrome://extensions/)')
    console.log('   2. Enable Developer mode and click "Load unpacked"')
    console.log('   3. Make changes to your code')
    console.log('   4. Extension will auto-rebuild')
    console.log('   5. Click the extension reload button in Chrome')
    console.log('\n💡 Tips:')
    console.log('   - Use Chrome DevTools for debugging')
    console.log('   - Check the extension popup and background page for logs')
    console.log('   - Visit LeetCode to test the content script')
    console.log('\n🛑 Press Ctrl+C to stop the development server')
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping development server...')
      
      if (buildProcess) {
        buildProcess.kill()
      }
      
      watcher.close()
      console.log('✅ Development server stopped')
      process.exit(0)
    })
    
    // Keep the process alive
    process.stdin.resume()
    
  } catch (error) {
    console.error('\n❌ Development server failed to start:', error.message)
    process.exit(1)
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
LeetShip Development Server

Usage: npm run dev

Options:
  --help, -h     Show this help message

The development server will:
  - Build the extension in development mode
  - Watch for file changes and rebuild automatically
  - Provide helpful development tips and workflows

For production builds, use: npm run build
For packaged builds, use: npm run build:chrome or npm run build:firefox
`)
  process.exit(0)
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}