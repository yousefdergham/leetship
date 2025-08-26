#!/usr/bin/env node

import { exec } from 'child_process'
import { promisify } from 'util'
import { copyFile, mkdir, readdir, stat, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const publicDir = join(rootDir, 'public')

const BROWSER_CONFIGS = {
  chrome: {
    manifestChanges: {
      browser_specific_settings: undefined, // Remove Firefox-specific settings
    },
    outputDir: join(rootDir, 'dist-chrome'),
  },
  firefox: {
    manifestChanges: {
      manifest_version: 2,
      background: {
        scripts: ["background/service-worker.js"]
      },
      browser_action: {
        default_popup: "options.html",
        default_title: "LeetShip",
        default_icon: {
          "16": "icons/icon-16.png",
          "48": "icons/icon-48.png",
          "128": "icons/icon-128.png"
        }
      },
      options_page: "options.html"
    },
    outputDir: join(rootDir, 'dist-firefox'),
  },
}

async function copyDir(src, dest) {
  try {
    await mkdir(dest, { recursive: true })
    const entries = await readdir(src)

    for (const entry of entries) {
      const srcPath = join(src, entry)
      const destPath = join(dest, entry)
      const entryStat = await stat(srcPath)

      if (entryStat.isDirectory()) {
        await copyDir(srcPath, destPath)
      } else {
        await copyFile(srcPath, destPath)
      }
    }
  } catch (error) {
    console.error(`Error copying ${src} to ${dest}:`, error.message)
    throw error
  }
}

async function modifyManifestForBrowser(browser, outputDir) {
  const manifestPath = join(outputDir, 'manifest.json')
  const manifestContent = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestContent)

  const config = BROWSER_CONFIGS[browser]

  if (browser === 'firefox') {
    // For Firefox, replace the entire manifest structure
    const firefoxManifest = {
      manifest_version: 2,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      permissions: [...manifest.permissions.filter(p => p !== 'background'), ...manifest.host_permissions],
      background: {
        scripts: ["background/service-worker.js"]
      },
      content_scripts: manifest.content_scripts.map(cs => ({
        ...cs,
        run_at: "document_end"
      })),
      browser_action: {
        default_popup: "options.html",
        default_title: "LeetShip",
        default_icon: {
          "16": "icons/icon-16.png",
          "48": "icons/icon-48.png",
          "128": "icons/icon-128.png"
        }
      },
      options_page: "options.html",
      icons: manifest.icons,
      web_accessible_resources: ["icons/*", "injected/inject.js"],
      browser_specific_settings: {
        gecko: {
          id: "leetship@extension.local"
        }
      }
    }

    await writeFile(manifestPath, JSON.stringify(firefoxManifest, null, 2))
  } else {
    // For Chrome, apply the changes normally
    Object.assign(manifest, config.manifestChanges)
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  }

  console.log(`✅ Modified manifest.json for ${browser}`)
}

async function buildForBrowser(browser) {
  console.log(`\n🔨 Building for ${browser}...`)

  const config = BROWSER_CONFIGS[browser]
  const outputDir = config.outputDir

  try {
    // Clean and create output directory
    await execAsync(`rm -rf "${outputDir}"`)
    await mkdir(outputDir, { recursive: true })

    // Copy built files from dist
    await copyDir(distDir, outputDir)

    // Copy public files (icons, etc.)
    const publicFiles = await readdir(publicDir)
    for (const file of publicFiles) {
      if (file !== 'manifest.json') { // We'll handle manifest separately
        const srcPath = join(publicDir, file)
        const destPath = join(outputDir, file)
        const entryStat = await stat(srcPath)

        if (entryStat.isDirectory()) {
          await copyDir(srcPath, destPath)
        } else {
          await copyFile(srcPath, destPath)
        }
      }
    }

    // Copy HTML files from src/ui
    const uiDir = join(rootDir, 'src', 'ui')
    await copyFile(join(uiDir, 'options.html'), join(outputDir, 'options.html'))
    await copyFile(join(uiDir, 'onboarding.html'), join(outputDir, 'onboarding.html'))

    // Copy CSS files from src/styles
    const stylesDir = join(rootDir, 'src', 'styles')
    const outputStylesDir = join(outputDir, 'styles')
    await mkdir(outputStylesDir, { recursive: true })
    await copyDir(stylesDir, outputStylesDir)

    // Copy Firefox-specific background script
    if (browser === 'firefox') {
      await copyFile(join(rootDir, 'src', 'background', 'firefox-background.js'), join(outputDir, 'background', 'service-worker.js'))
    }

    // Copy and modify manifest
    await copyFile(join(publicDir, 'manifest.json'), join(outputDir, 'manifest.json'))
    await modifyManifestForBrowser(browser, outputDir)

    console.log(`✅ Built ${browser} extension in ${outputDir}`)
    return outputDir

  } catch (error) {
    console.error(`❌ Build failed for ${browser}:`, error.message)
    throw error
  }
}

async function createPackage(browser, outputDir) {
  console.log(`📦 Creating package for ${browser}...`)

  const packageName = `leetship-${browser}.${browser === 'firefox' ? 'xpi' : 'zip'}`
  const packagePath = join(rootDir, packageName)

  try {
    // Remove existing package
    await execAsync(`rm -f "${packagePath}"`)

    // Create package
    const { stdout } = await execAsync(`cd "${outputDir}" && zip -r "../${packageName}" .`)
    console.log(`✅ Created package: ${packageName}`)

    // Show package info
    const { stdout: sizeInfo } = await execAsync(`ls -lh "${packagePath}"`)
    console.log(`📊 Package size: ${sizeInfo.split(' ')[4]}`)

    return packagePath

  } catch (error) {
    console.error(`❌ Package creation failed for ${browser}:`, error.message)
    throw error
  }
}

async function generateIcons() {
  console.log('🎨 Generating icons...')

  const iconDir = join(publicDir, 'icons')
  await mkdir(iconDir, { recursive: true })

  // For now, create placeholder icons
  // In a real project, you'd use a tool like sharp or imagemagick to generate actual icons
  const iconSizes = [16, 48, 128]

  for (const size of iconSizes) {
    const iconPath = join(iconDir, `icon-${size}.png`)

    // Create a simple SVG that can be converted to PNG
    const svgContent = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#10b981" rx="${size / 8}"/>
        <text x="${size / 2}" y="${size / 2 + 4}" font-family="Arial, sans-serif" font-size="${size / 3}" fill="white" text-anchor="middle" dominant-baseline="middle">AC</text>
      </svg>
    `

    // Note: In production, you'd convert SVG to PNG here
    // For now, we'll just create the SVG file with .png extension as a placeholder
    try {
      await writeFile(iconPath.replace('.png', '.svg'), svgContent)
      console.log(`📝 Created placeholder for ${iconPath}`)
    } catch (error) {
      console.warn(`⚠️  Could not create icon ${iconPath}: ${error.message}`)
    }
  }

  console.log('ℹ️  Icon generation completed (placeholders created)')
  console.log('ℹ️  Please replace placeholder icons with actual PNG files before publishing')
}

async function main() {
  try {
    console.log('🚀 Starting LeetShip build process...')

    // Generate icons first
    await generateIcons()

    // Run TypeScript compilation and Vite build
    console.log('\n📦 Running TypeScript compilation...')
    await execAsync('npm run build')
    console.log('✅ TypeScript compilation completed')

    // Build for each browser
    const browsers = process.argv.includes('--chrome-only')
      ? ['chrome']
      : process.argv.includes('--firefox-only')
        ? ['firefox']
        : ['chrome', 'firefox']

    for (const browser of browsers) {
      const outputDir = await buildForBrowser(browser)

      if (process.argv.includes('--package')) {
        await createPackage(browser, outputDir)
      }
    }

    console.log('\n🎉 Build completed successfully!')

    if (process.argv.includes('--package')) {
      console.log('\n📦 Packages created:')
      for (const browser of browsers) {
        const packageName = `leetship-${browser}.${browser === 'firefox' ? 'xpi' : 'zip'}`
        console.log(`   - ${packageName}`)
      }
    }

    console.log('\n📋 Next steps:')
    console.log('   1. Test the extension by loading dist-chrome/ or dist-firefox/')
    console.log('   2. Update the GitHub client ID in src/lib/auth/github.ts')
    console.log('   3. Replace placeholder icons with actual PNG files')
    console.log('   4. Run tests: npm test')
    console.log('   5. Package for distribution: npm run build -- --package')

  } catch (error) {
    console.error('\n❌ Build process failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}

export { buildForBrowser, createPackage, generateIcons }