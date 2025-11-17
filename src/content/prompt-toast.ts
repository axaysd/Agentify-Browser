/**
 * Prompt buttons content script
 * Shows disappearing buttons on the main page when prompts are available
 */

import { getSuggestivePrompts } from '@/lib/utils/predefinedPrompts'
import { getDisplayTextFromPrompt } from '@/lib/utils/promptDisplay'

(() => {
  const BUTTONS_CONTAINER_ID = 'browseros-prompt-buttons'
  const BUTTONS_STYLES_ID = 'browseros-prompt-buttons-styles'
  const BUTTONS_INITIALIZED_KEY = 'browseros-prompt-buttons-initialized'
  
  // Check if already initialized to prevent duplicate listeners
  if ((window as any)[BUTTONS_INITIALIZED_KEY]) {
    return
  }
  (window as any)[BUTTONS_INITIALIZED_KEY] = true
  
  /**
   * Create and inject button styles
   */
  function injectStyles(): void {
    if (document.getElementById(BUTTONS_STYLES_ID)) {
      return
    }
    
    const style = document.createElement('style')
    style.id = BUTTONS_STYLES_ID
    style.textContent = `
      @keyframes browseros-buttons-fade-in {
        from {
          opacity: 0;
          transform: translateY(-50%) translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      }
      
      @keyframes browseros-buttons-fade-out {
        from {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
        to {
          opacity: 0;
          transform: translateY(-50%) translateX(20px);
        }
      }
      
      #${BUTTONS_CONTAINER_ID} {
        position: fixed !important;
        top: 50% !important;
        right: 16px !important;
        transform: translateY(-50%) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        animation: browseros-buttons-fade-in 0.3s ease-out forwards !important;
      }
      
      #${BUTTONS_CONTAINER_ID}.fade-out {
        animation: browseros-buttons-fade-out 0.3s ease-in forwards !important;
      }
      
      .browseros-prompt-button {
        padding: 10px 16px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        background-color: #fb6618 !important;
        color: white !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        pointer-events: auto !important;
      }
      
      .browseros-prompt-button:hover {
        background-color: #e55a14 !important;
        transform: scale(1.05) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
      }
      
      .browseros-prompt-button:active {
        transform: scale(0.98) !important;
      }
    `
    document.head.appendChild(style)
  }
  
  /**
   * Show prompt buttons
   */
  function showButtons(prompts: string[]): void {
    // Remove existing buttons if present
    hideButtons()
    
    if (prompts.length === 0) return
    
    // Inject styles
    injectStyles()
    
    // Create container
    const container = document.createElement('div')
    container.id = BUTTONS_CONTAINER_ID
    
    // Create buttons for each prompt
    prompts.forEach((prompt) => {
      const button = document.createElement('button')
      button.className = 'browseros-prompt-button'
      button.textContent = getDisplayTextFromPrompt(prompt)
      button.setAttribute('aria-label', `Use prompt: ${prompt}`)
      
      button.addEventListener('click', () => {
        // Send prompt to side panel
        chrome.runtime.sendMessage({
          type: 'FILL_PROMPT_INPUT',
          prompt: prompt
        }).catch(() => {
          // Ignore errors if side panel is not open
        })
        
        // Hide buttons after click
        hideButtons()
      })
      
      container.appendChild(button)
    })
    
    document.body.appendChild(container)
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      hideButtons()
    }, 5000)
  }
  
  /**
   * Hide prompt buttons
   */
  function hideButtons(): void {
    const container = document.getElementById(BUTTONS_CONTAINER_ID)
    if (container) {
      container.classList.add('fade-out')
      setTimeout(() => {
        container.remove()
      }, 300) // Match animation duration
    }
  }
  
  /**
   * Check if app mode is 'agent'
   */
  function isAgentMode(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.storage?.local?.get('nxtscape-settings', (result) => {
          if (result && result['nxtscape-settings']) {
            try {
              const parsed = JSON.parse(result['nxtscape-settings'])
              // Settings can be stored as { state: {...} } or directly as {...}
              const settings = parsed.state || parsed
              resolve(settings.appMode === 'agent')
            } catch {
              // Default to agent mode if parsing fails
              resolve(true)
            }
          } else {
            // Default to agent mode if settings not found
            resolve(true)
          }
        })
      } catch {
        // Default to agent mode on error
        resolve(true)
      }
    })
  }
  
  /**
   * Check current page and show buttons if needed
   */
  async function checkAndShowButtons(): Promise<void> {
    // Get current URL
    const currentUrl = window.location.href
    
    // Get prompts for current URL
    const prompts = getSuggestivePrompts(currentUrl)
    
    if (prompts.length > 0) {
      showButtons(prompts)
    }
  }
  
  /**
   * Message listener
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.source !== 'PromptToastService') {
      return
    }
    
    switch (request.action) {
      case 'hideButtons':
        hideButtons()
        sendResponse({ success: true })
        break
        
      case 'checkAndShow':
        checkAndShowButtons().then(() => {
          sendResponse({ success: true })
        })
        return true // Keep channel open for async
        
      default:
        sendResponse({ success: false, error: 'Unknown action' })
    }
    
    return true
  })
  
  // Show buttons on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndShowButtons, 500) // Small delay to ensure page is ready
    })
  } else {
    setTimeout(checkAndShowButtons, 500)
  }
  
  // Also check on URL changes (for SPAs)
  let lastUrl = window.location.href
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      checkAndShowButtons()
    }
  }, 1000)
  
  // Clean up interval on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval)
  })
})()

