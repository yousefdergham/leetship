import browser from 'webextension-polyfill'

export interface BrowserAPI {
  storage: typeof browser.storage
  identity: typeof browser.identity
  notifications: typeof browser.notifications
  runtime: typeof browser.runtime
  tabs: typeof browser.tabs
}

export const getBrowser = (): BrowserAPI => {
  if (isChrome()) {
    return {
      storage: chrome.storage as any,
      identity: chrome.identity as any,
      notifications: chrome.notifications as any,
      runtime: chrome.runtime as any,
      tabs: chrome.tabs as any,
    }
  }

  // For Firefox, ensure browser is available
  if (typeof browser === 'undefined') {
    throw new Error('Browser API not available')
  }

  return {
    storage: browser.storage,
    identity: browser.identity,
    notifications: browser.notifications,
    runtime: browser.runtime,
    tabs: browser.tabs,
  }
}

export const isChrome = (): boolean => {
  // Firefox also provides chrome object for compatibility, so we need to check more specifically
  return typeof chrome !== 'undefined' && chrome.runtime !== undefined && 
         !navigator.userAgent.includes('Firefox') && 
         (typeof browser === 'undefined' || chrome.runtime.getURL('').includes('chrome-extension'))
}

export const isFirefox = (): boolean => {
  return navigator.userAgent.includes('Firefox') || 
         (typeof browser !== 'undefined' && 
          typeof chrome !== 'undefined' && 
          chrome.runtime.getURL('').includes('moz-extension'))
}
