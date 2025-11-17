import React from 'react'
import { cn } from '@/sidepanel/lib/utils'

interface PromptBadgeProps {
  text: string
  className?: string
}

/**
 * Badge component for displaying prompt word+emoji in header
 * Small, subtle indicator that shows when prompts are active
 */
export function PromptBadge({ text, className }: PromptBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
        'bg-brand/10 border border-brand/20',
        'text-xs font-semibold text-brand',
        className
      )}
      title={`Suggested prompt: ${text}`}
      aria-label={`Active prompt suggestion: ${text}`}
    >
      <span>{text}</span>
    </div>
  )
}

