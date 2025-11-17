import React, { useEffect, useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface PromptToastProps {
  text: string
  isVisible: boolean
  onDismiss: () => void
}

/**
 * Toast notification component for displaying prompt word+emoji
 * Appears in middle-right of screen, auto-dismisses after 2.5 seconds
 */
export function PromptToast({ text, isVisible, onDismiss }: PromptToastProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Trigger animation after mount
      setTimeout(() => setIsAnimating(true), 10)
      
      // Auto-dismiss after 2.5 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setTimeout(() => {
          setShouldRender(false)
          onDismiss()
        }, 300) // Wait for fade-out animation
      }, 2500)
      
      return () => clearTimeout(timer)
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onDismiss])

  if (!shouldRender) return null

  return (
    <div
      className={cn(
        'fixed right-4 top-1/2 -translate-y-1/2 z-50',
        'px-4 py-3 rounded-xl shadow-lg',
        'bg-background/95 backdrop-blur-sm border-2 border-brand/30',
        'transition-all duration-300 ease-out',
        isAnimating
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full'
      )}
      role="status"
      aria-live="polite"
      aria-label={`Prompt suggestion: ${text}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-foreground">{text}</span>
      </div>
    </div>
  )
}

