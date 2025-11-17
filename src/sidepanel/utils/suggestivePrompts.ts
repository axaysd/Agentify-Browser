/**
 * Utility for getting suggestive prompts based on current page URL
 * Re-exports from shared predefined prompts registry
 */

export { 
  getSuggestivePrompts,
  matchPattern,
  URL_BASED_PROMPT_MAPPINGS,
  GLOBAL_PREDEFINED_PROMPTS,
  getPredefinedTaskMetadata,
  type PredefinedPromptDefinition,
  type URLBasedPromptMapping
} from '@/lib/utils/predefinedPrompts'

