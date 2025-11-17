import { Logging } from '@/lib/utils/Logging'

const NAVIGATION_DELAY_MS = 500  // Delay after navigation before injection

/**
 * Service to manage prompt toast notifications on browser tabs
 * Shows toast when prompts are available for the current page
 */
export class PromptToastService {
  private static instance: PromptToastService
  private injectedTabs: Set<number> = new Set()
  private navigationListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null

  private constructor() {
    this._setupNavigationListener()
  }

  static getInstance(): PromptToastService {
    if (!PromptToastService.instance) {
      PromptToastService.instance = new PromptToastService()
    }
    return PromptToastService.instance
  }

  /**
   * Inject prompt toast script on a specific tab
   */
  private async _injectPromptToast(tabId: number): Promise<void> {
    try {
      // Skip if already injected (will be re-injected on navigation)
      if (this.injectedTabs.has(tabId)) {
        return
      }

      // Check if tab exists
      try {
        await chrome.tabs.get(tabId)
      } catch (error) {
        this.injectedTabs.delete(tabId)
        return
      }

      // Skip chrome:// and extension:// pages
      try {
        const tab = await chrome.tabs.get(tabId)
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
          return
        }
      } catch (error) {
        return
      }

      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['prompt-toast.js']
      })

      // Send check message to show toast if needed
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'checkAndShow',
          source: 'PromptToastService'
        })
      } catch (error) {
        // Script might not be ready yet, that's okay
        Logging.log('PromptToastService', `Failed to send check message to tab ${tabId}: ${error}`, 'warning')
      }

      this.injectedTabs.add(tabId)
      Logging.log('PromptToastService', `Injected prompt toast on tab ${tabId}`)
    } catch (error) {
      Logging.log('PromptToastService', `Failed to inject prompt toast on tab ${tabId}: ${error}`, 'warning')
    }
  }

  /**
   * Hide buttons on a specific tab (called when side panel opens)
   */
  async hideButtons(tabId: number): Promise<void> {
    try {
      if (!this.injectedTabs.has(tabId)) {
        return
      }

      // Send hide message
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'hideButtons',
          source: 'PromptToastService'
        })
      } catch (error) {
        // Tab might be closed or navigated away
        Logging.log('PromptToastService', `Failed to send hide message to tab ${tabId}: ${error}`, 'warning')
      }
    } catch (error) {
      Logging.log('PromptToastService', `Failed to hide buttons on tab ${tabId}: ${error}`, 'warning')
    }
  }

  /**
   * Hide buttons on active tab
   */
  async hideButtonsOnActiveTab(): Promise<void> {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (activeTab?.id) {
        await this.hideButtons(activeTab.id)
      }
    } catch (error) {
      Logging.log('PromptToastService', `Failed to hide buttons on active tab: ${error}`, 'warning')
    }
  }

  /**
   * Setup navigation listener to inject on all page navigations
   */
  private _setupNavigationListener(): void {
    this.navigationListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      // Only handle committed navigations in the main frame
      if (details.frameId !== 0) return
      
      // Remove from injected set on navigation (will be re-injected)
      this.injectedTabs.delete(details.tabId)
      
      // Wait a bit for the page to load before injecting
      setTimeout(() => {
        this._injectPromptToast(details.tabId)
      }, NAVIGATION_DELAY_MS)
    }
    
    // Listen for navigation commits (when a new page starts loading)
    chrome.webNavigation.onCommitted.addListener(this.navigationListener)
    
    // Also inject on existing tabs when service starts
    this._injectOnExistingTabs()
  }

  /**
   * Inject on all existing tabs
   */
  private async _injectOnExistingTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('moz-extension://')) {
          setTimeout(() => {
            this._injectPromptToast(tab.id!)
          }, NAVIGATION_DELAY_MS)
        }
      }
    } catch (error) {
      Logging.log('PromptToastService', `Failed to inject on existing tabs: ${error}`, 'warning')
    }
  }

  /**
   * Clean up for closed tabs
   */
  handleTabClosed(tabId: number): void {
    if (this.injectedTabs.has(tabId)) {
      this.injectedTabs.delete(tabId)
      Logging.log('PromptToastService', `Cleaned up prompt toast for closed tab ${tabId}`)
    }
  }

  /**
   * Cleanup method to remove listeners
   */
  cleanup(): void {
    if (this.navigationListener) {
      chrome.webNavigation.onCommitted.removeListener(this.navigationListener)
      this.navigationListener = null
    }
    this.injectedTabs.clear()
  }
}

