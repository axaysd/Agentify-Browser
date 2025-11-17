import React, { useEffect, useState, useCallback } from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { Chat } from './components/Chat'
import { TeachMode, useTeachModeStore } from './teachmode'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAnnouncer, setGlobalAnnouncer } from './hooks/useAnnouncer'
import { SkipLink } from './components/SkipLink'
import { useSettingsStore } from './stores/settingsStore'
import { HumanInputDialog } from './components/HumanInputDialog'
import { Header } from './components/Header'
import { ModeToggle } from './components/ModeToggle'
import { useChatStore } from './stores/chatStore'
import './styles.css'

/**
 * Root component for sidepanel v2
 * Uses Tailwind CSS for styling
 */
export function App() {
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()

  // Initialize message handling
  const { humanInputRequest, clearHumanInputRequest } = useMessageHandler()

  // Initialize settings
  const { fontSize, theme, appMode, setAppMode } = useSettingsStore()

  // Get chat state for header
  const { messages, isProcessing, reset } = useChatStore()

  // Get teach mode state for header
  const { teachModeState, abortTeachExecution } = useTeachModeStore(state => ({
    teachModeState: state.mode,
    abortTeachExecution: state.abortExecution
  }))

  // Check if any execution is running (chat or teach mode)
  const isExecuting = isProcessing || teachModeState === 'executing'
  
  // State to track pending prompt (for mode switching)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  
  // Initialize global announcer for screen readers
  const announcer = useAnnouncer()
  useEffect(() => {
    setGlobalAnnouncer(announcer)
  }, [announcer])
  
  // Initialize settings on app load
  useEffect(() => {
    // Apply font size
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)

    // Apply theme classes
    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.remove('gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [fontSize, theme])
  
  // Hide prompt buttons when side panel opens
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: 'HIDE_PROMPT_TOAST'
    }).catch(() => {
      // Ignore errors - background script might not be ready
    })
  }, []) // Run once on mount
  
  // Function to fill input and highlight submit button
  const fillInputAndHighlight = useCallback((prompt: string) => {
    // Dispatch event to fill input
    window.dispatchEvent(new CustomEvent('setInputValue', {
      detail: prompt
    }))
    
    // Highlight submit button
    setTimeout(() => {
      const submitButton = document.querySelector('button[type="submit"]') as HTMLElement
      if (submitButton) {
        submitButton.style.animation = 'none'
        submitButton.offsetHeight // Trigger reflow
        submitButton.style.animation = 'pulse 1s ease-in-out 3'
        submitButton.style.boxShadow = '0 0 20px rgba(251, 102, 24, 0.6)'
        
        // Remove highlight after animation
        setTimeout(() => {
          submitButton.style.boxShadow = ''
          submitButton.style.animation = ''
        }, 3000)
      }
    }, 100)
    
    // Clear the pending prompt from storage
    chrome.storage.local.remove('pendingPrompt')
  }, [])
  
  // Listen for prompt input fill messages
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'FILL_PROMPT_INPUT' && message.prompt) {
        // If we're not in agent mode, switch first and store the prompt
        if (appMode !== 'agent') {
          setAppMode('agent')
          setPendingPrompt(message.prompt)
        } else {
          // Already in agent mode, fill immediately
          fillInputAndHighlight(message.prompt)
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [fillInputAndHighlight, appMode, setAppMode])
  
  // Check for pending prompt and mode switch flag on mount
  useEffect(() => {
    chrome.storage.local.get(['pendingPrompt', 'switchToAgentMode'], (result) => {
      // Switch to agent mode if flag is set
      if (result.switchToAgentMode) {
        setAppMode('agent')
        chrome.storage.local.remove('switchToAgentMode')
      }
      
      // Store pending prompt in state (don't fill yet - wait for mode switch)
      if (result.pendingPrompt) {
        setPendingPrompt(result.pendingPrompt)
        chrome.storage.local.remove('pendingPrompt')
      }
    })
  }, [setAppMode])
  
  // Fill input when we're in agent mode and have a pending prompt
  useEffect(() => {
    if (appMode === 'agent' && pendingPrompt) {
      // Wait a bit for Chat component to render and ChatInput to be ready
      const timer = setTimeout(() => {
        fillInputAndHighlight(pendingPrompt)
        setPendingPrompt(null)
      }, 300)
      
      return () => clearTimeout(timer)
    }
  }, [appMode, pendingPrompt, fillInputAndHighlight])

  // Listen for theme changes from other tabs/views
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nxtscape-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue)
          const newTheme = newSettings?.state?.theme
          const newFontSize = newSettings?.state?.fontSize

          // Update theme if changed
          if (newTheme && newTheme !== theme) {
            const root = document.documentElement
            root.classList.remove('dark', 'gray')
            if (newTheme === 'dark') root.classList.add('dark')
            if (newTheme === 'gray') root.classList.add('gray')
            // Force store update
            useSettingsStore.setState({ theme: newTheme })
          }

          // Update font size if changed
          if (newFontSize && newFontSize !== fontSize) {
            document.documentElement.style.setProperty('--app-font-size', `${newFontSize}px`)
            useSettingsStore.setState({ fontSize: newFontSize })
          }
        } catch (err) {
          console.error('Failed to parse settings from storage:', err)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [theme, fontSize])
  
  // Announce connection status changes
  useEffect(() => {
    announcer.announce(connected ? 'Extension connected' : 'Extension disconnected')
  }, [connected, announcer])
  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to analytics or error reporting service
        console.error('App level error:', error, errorInfo)
        announcer.announce('An error occurred. Please try again.', 'assertive')
      }}
    >
      <div className="h-screen bg-background overflow-x-hidden flex flex-col" role="main" aria-label="BrowserOS Chat Assistant">
        <SkipLink />

        {/* Header - always visible at top */}
        <Header
          onReset={() => {
            // Reset based on current mode
            if (appMode === 'teach' && teachModeState === 'executing') {
              abortTeachExecution()
            } else {
              reset()
            }
          }}
          showReset={messages.length > 0 || (appMode === 'teach' && teachModeState !== 'idle')}
          isProcessing={isExecuting}
          isTeachMode={appMode === 'teach'}
        />

        {/* Main content area - changes based on mode */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {appMode === 'teach' ? (
            <TeachMode />
          ) : (
            <Chat
              isConnected={connected}
            />
          )}
        </div>

        {/* Mode Toggle - always visible at bottom */}
        <div className="border-t border-border bg-background px-2 py-2">
          <ModeToggle />
        </div>

        {humanInputRequest && (
          <HumanInputDialog
            requestId={humanInputRequest.requestId}
            prompt={humanInputRequest.prompt}
            onClose={clearHumanInputRequest}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}