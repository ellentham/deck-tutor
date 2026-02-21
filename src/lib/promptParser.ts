/**
 * Parse chat prompts to extract card names and deck-building intent.
 * Builds Scryfall-compatible queries from natural language.
 * @see https://scryfall.com/docs/syntax
 */

export interface ParsedPrompt {
  /** Extracted card name(s) for lookup */
  cardNames: string[]
  /** Scryfall search query (syntax-aware) */
  searchQuery: string
  /** Use named API for exact card lookup instead of search */
  useNamedLookup: boolean
  /** Format context: commander, modern, etc. */
  format?: string
  /** Is the user asking about a commander specifically */
  isCommanderContext: boolean
}

/** Phrases that indicate commander/format context */
const COMMANDER_PHRASES = [
  /\b(as\s+the?\s+)?commander\b/i,
  /\b(for\s+my\s+)?commander\s+deck\b/i,
  /\bcommander\s+deck\b/i,
  /\b(use|using)\s+.*\s+as\s+commander\b/i,
]

/** Format keywords for Scryfall f: syntax */
const FORMAT_ALIASES: Record<string, string> = {
  commander: 'commander',
  edh: 'commander',
  modern: 'modern',
  standard: 'standard',
  pioneer: 'pioneer',
  legacy: 'legacy',
  vintage: 'vintage',
  pauper: 'pauper',
  brawl: 'brawl',
  duel: 'duel',
}

/**
 * Map natural language phrases to Scryfall search syntax.
 * Enables queries like "ramp cards for green" → o:ramp c:g
 */
const SEMANTIC_MAPPINGS: Array<{ pattern: RegExp; replacement: string }> = [
  // Ramp / mana acceleration
  { pattern: /\bramp\b/i, replacement: 'o:ramp OR (o:add o:mana)' },
  { pattern: /\bmana\s*rock/i, replacement: 't:artifact o:add' },
  { pattern: /\bmana\s*dork/i, replacement: 't:creature o:add' },
  // Card draw
  { pattern: /\bdraw\b/i, replacement: 'o:draw' },
  { pattern: /\bcard\s*draw/i, replacement: 'o:draw' },
  // Removal
  { pattern: /\bremoval\b/i, replacement: '(o:destroy OR o:exile OR o:target)' },
  { pattern: /\bboard\s*wipe/i, replacement: '(o:destroy o:all OR o:exile o:all)' },
  { pattern: /\bcounterspell/i, replacement: 'o:counter t:spell' },
  // Colors (standalone words)
  { pattern: /\bgreen\b/i, replacement: 'c:g' },
  { pattern: /\bred\b/i, replacement: 'c:r' },
  { pattern: /\bblue\b/i, replacement: 'c:u' },
  { pattern: /\bblack\b/i, replacement: 'c:b' },
  { pattern: /\bwhite\b/i, replacement: 'c:w' },
  // Card types
  { pattern: /\bcreatures?\b/i, replacement: 't:creature' },
  { pattern: /\binstants?\b/i, replacement: 't:instant' },
  { pattern: /\bsorcer(?:y|ies)\b/i, replacement: 't:sorcery' },
  { pattern: /\blands?\b/i, replacement: 't:land' },
  { pattern: /\bartifacts?\b/i, replacement: 't:artifact' },
  { pattern: /\benchantments?\b/i, replacement: 't:enchantment' },
  { pattern: /\bplaneswalkers?\b/i, replacement: 't:planeswalker' },
  // Mechanics
  { pattern: /\bsacrifice\b/i, replacement: 'o:sacrifice' },
  { pattern: /\benters\s+the\s+battlefield\b/i, replacement: 'o:"enters the battlefield"' },
  { pattern: /\betb\b/i, replacement: 'o:"enters the battlefield"' },
  { pattern: /\bwhenever.*draw/i, replacement: 'o:"whenever" o:draw' },
  { pattern: /\bflying\b/i, replacement: 'kw:flying' },
  { pattern: /\btrample\b/i, replacement: 'kw:trample' },
  { pattern: /\bhaste\b/i, replacement: 'kw:haste' },
  { pattern: /\blifelink\b/i, replacement: 'kw:lifelink' },
  { pattern: /\bdeathtouch\b/i, replacement: 'kw:deathtouch' },
  // Commander-specific
  { pattern: /\bcommanders?\b/i, replacement: 'is:commander' },
]

/**
 * Convert natural language prompt to Scryfall syntax.
 * Applies semantic mappings and removes filler words.
 */
function toScryfallSyntax(prompt: string): string {
  let result = prompt.trim()
  if (!result) return result

  for (const { pattern, replacement } of SEMANTIC_MAPPINGS) {
    result = result.replace(pattern, replacement)
  }

  // Remove common filler words that Scryfall doesn't understand
  result = result.replace(
    /\b(show|me|cards?|for|a|an|the|that|with|in|my|deck|recommend|suggest|find)\b/gi,
    ' '
  )
  result = result.replace(/\b\d+\b/g, ' ') // Remove numbers like "5" from "recommend 5 creatures"
  result = result.replace(/\s+/g, ' ').trim()

  return result || prompt.trim()
}

/**
 * Extract card name from phrases like "X as the commander" or "cards for X deck".
 * Handles "Maralen, Fae Ascendant" (with comma) and "Lightning Bolt" style names.
 */
function extractCardName(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // "X as the commander" / "X as commander" - e.g. "Maralen, Fae Ascendant as the commander"
  const commanderMatch = trimmed.match(
    /^(.+?)\s+(?:as\s+(?:the\s+)?commander|for\s+(?:my\s+)?commander\s+deck)/i
  )
  if (commanderMatch) {
    return commanderMatch[1].trim()
  }

  // "commander: X" or "commander is X"
  const commanderIsMatch = trimmed.match(
    /commander\s+(?:is|:)\s*(.+?)(?:\s|$|\.)/i
  )
  if (commanderIsMatch) {
    return commanderIsMatch[1].trim()
  }

  // "suggest cards for X" - X might be a card name (avoid "recommend N cards for X deck" - we want search)
  const suggestMatch = trimmed.match(
    /(?:suggest|find|show)\s+(?:me\s+)?(?:cards?\s+)?(?:for|with)\s+(.+?)(?:\s|$|\.)/i
  )
  if (suggestMatch) {
    return suggestMatch[1].trim()
  }

  return null
}

/**
 * Check if the prompt indicates commander/format context.
 */
function detectCommanderContext(text: string): boolean {
  return COMMANDER_PHRASES.some((re) => re.test(text))
}

/**
 * Extract format from prompt (e.g. "modern deck", "commander", "for pioneer").
 */
function extractFormat(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const [alias, format] of Object.entries(FORMAT_ALIASES)) {
    if (lower.includes(alias)) return format
  }
  return undefined
}

/**
 * Build Scryfall search query from parsed intent.
 * - Exact name: use !"Card Name" for single exact match
 * - Commander: add is:commander when looking for commander-legal cards
 * - Format: add f:format when format is specified
 */
export function parseSearchPrompt(prompt: string): ParsedPrompt {
  const trimmed = prompt.trim()
  const isCommander = detectCommanderContext(trimmed)
  const format = extractFormat(trimmed) ?? (isCommander ? 'commander' : undefined)

  // Try to extract a specific card name for named lookup
  const extractedName = extractCardName(trimmed)
  if (extractedName) {
    // Use Scryfall named API for exact/fuzzy lookup of this card
    return {
      cardNames: [extractedName],
      searchQuery: `!"${extractedName}"`, // Exact name in search syntax
      useNamedLookup: true,
      format,
      isCommanderContext: isCommander,
    }
  }

  // No specific card extracted - convert natural language to Scryfall syntax
  let searchQuery = toScryfallSyntax(trimmed)
  const parts: string[] = [searchQuery]
  if (isCommander) {
    parts.unshift('is:commander')
  }
  if (format && !isCommander) {
    parts.unshift(`f:${format}`)
  }

  return {
    cardNames: [],
    searchQuery: parts.join(' '),
    useNamedLookup: false,
    format,
    isCommanderContext: isCommander,
  }
}
