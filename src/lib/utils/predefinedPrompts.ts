/**
 * Central registry for all predefined prompts with full execution metadata
 * Structure matches the return type of _getSpecialTaskMetadata()
 */

import type { ExecutionMetadata } from '@/lib/types/messaging'

// Structure matching _getSpecialTaskMetadata return type
export interface PredefinedPromptDefinition {
  prompt: string  // Display text shown to user (with emoji)
  normalizedPrompt: string  // Normalized for matching (lowercase, trimmed)
  task: string  // Normalized task description (what agent sees)
  metadata: ExecutionMetadata  // Full execution metadata
}

// URL pattern to prompts mapping
export interface URLBasedPromptMapping {
  pattern: string  // URL pattern (e.g., '*leetcode.com/problems/*')
  prompts: PredefinedPromptDefinition[]  // Prompts with full metadata
}

// Global prompts (not tied to specific URLs) - matches _getSpecialTaskMetadata structure
export const GLOBAL_PREDEFINED_PROMPTS: PredefinedPromptDefinition[] = [
  {
    prompt: 'Read about our vision and upvote ❤️',
    normalizedPrompt: 'read about our vision and upvote ❤️',
    task: 'Read about our vision and upvote',
    metadata: {
      executionMode: 'predefined' as const,
      predefinedPlan: {
        agentId: 'browseros-launch-upvoter',
        name: 'BrowserOS Launch Upvoter',
        goal: 'Navigate to BrowserOS launch page and upvote it',
        steps: [
          'Navigate to https://dub.sh/browseros-launch',
          'Find and click the upvote button on the page using visual_click',
          'Use celebration tool to show confetti animation'
        ]
      }
    }
  },
  {
    prompt: 'Support BrowserOS on Github ⭐',
    normalizedPrompt: 'support browseros on github ⭐',
    task: 'Support BrowserOS on GitHub',
    metadata: {
      executionMode: 'predefined' as const,
      predefinedPlan: {
        agentId: 'github-star-browseros',
        name: 'GitHub Repository Star',
        goal: 'Navigate to BrowserOS GitHub repo and star it',
        steps: [
          'Navigate to https://git.new/browserOS',
          'Check if the star button indicates already starred (filled star icon)',
          'If not starred (outline star icon), click the star button to star the repository',
          'Use celebration_tool to show confetti animation'
        ]
      }
    }
  }
]

// URL-based prompt mappings - same structure
export const URL_BASED_PROMPT_MAPPINGS: URLBasedPromptMapping[] = [
  {
    pattern: '*leetcode.com/problems/*',
    prompts: [
      {
        prompt: 'Fix my code to pass all test cases 🔧',
        normalizedPrompt: 'fix my code to pass all test cases 🔧',
        task: 'Fix my code to pass all test cases',
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'leetcode-code-fixer',
            name: 'LeetCode Code Fixer',
            goal: 'Fix the code to pass all test cases',
            steps: [
              'Extract the current code from the code editor panel using extract tool to get the full code content',
              'Extract the error message and details from the "Test Result" tab to understand what type of error occurred (syntax error, runtime error, wrong answer, etc.)',
              'Analyze the error message to identify the specific issue - check the error type, line number, and error description',
              'Click on the code editor area to focus it, then use key tool to press Ctrl+A (or Cmd+A on Mac) to select all existing code',
              'Use clear tool to clear the selected code from the editor',
              'Type the corrected code into the editor using type tool, fixing the identified issues (syntax errors, logic errors, missing code, incorrect algorithms, etc.)',
              'Click the "Run" button (or "Play" button) in the top toolbar to execute the code and test it',
              'Wait for test execution to complete using wait tool (typically 2-3 seconds for code execution)',
              'Extract the test results from the "Test Result" tab to check if the error is resolved and all test cases pass',
              'If error persists or tests still fail, extract the new error message, analyze what went wrong, clear the editor again with Ctrl+A and clear tool, then type the newly corrected code',
              'Repeat the run-test-check cycle until all test cases pass with no errors or wrong answers',
              'Once all tests pass successfully (check the "Test Result" tab shows success), click the "Submit" button in the top toolbar to submit the solution'
            ]
          }
        }
      },
      {
        prompt: 'Write an optimal solution with step-by-step explanation 📝',
        normalizedPrompt: 'write an optimal solution with step-by-step explanation 📝',
        task: 'Write an optimal solution with step-by-step explanation',
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'leetcode-solution-writer',
            name: 'LeetCode Solution Writer',
            goal: 'Write an optimal solution with step-by-step explanation',
            steps: [
              'Analyze the problem requirements',
              'Design an optimal algorithm',
              'Implement the solution',
              'Provide step-by-step explanation'
            ]
          }
        }
      }
    ]
  }
]

/**
 * Match URL against a pattern
 * Pattern format: *domain.com/path/*
 * Supports wildcards (*) for flexible matching
 */
export function matchPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url)
    const fullPath = `${urlObj.hostname}${urlObj.pathname}`
    
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/\*/g, '.*')  // Convert * to .*
    
    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(fullPath)
  } catch {
    return false
  }
}

/**
 * Get suggestive prompts for a given URL (returns just prompt strings for UI)
 */
export function getSuggestivePrompts(url: string | null | undefined): string[] {
  if (!url) return []
  
  for (const mapping of URL_BASED_PROMPT_MAPPINGS) {
    if (matchPattern(url, mapping.pattern)) {
      return mapping.prompts.slice(0, 2).map(p => p.prompt)
    }
  }
  
  return []
}

/**
 * Get predefined task metadata by prompt text
 * Returns structure matching _getSpecialTaskMetadata return type
 */
export function getPredefinedTaskMetadata(promptText: string): { task: string, metadata: ExecutionMetadata } | null {
  const normalized = promptText.toLowerCase().trim()
  
  // Check global prompts first
  for (const promptDef of GLOBAL_PREDEFINED_PROMPTS) {
    if (promptDef.normalizedPrompt === normalized || 
        promptText.toLowerCase() === promptDef.prompt.toLowerCase()) {
      return {
        task: promptDef.task,
        metadata: promptDef.metadata
      }
    }
  }
  
  // Check URL-based prompts
  for (const mapping of URL_BASED_PROMPT_MAPPINGS) {
    for (const promptDef of mapping.prompts) {
      if (promptDef.normalizedPrompt === normalized ||
          promptText.toLowerCase() === promptDef.prompt.toLowerCase()) {
        return {
          task: promptDef.task,
          metadata: promptDef.metadata
        }
      }
    }
  }
  
  return null
}

