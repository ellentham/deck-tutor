/**
 * Extract card names mentioned in a prompt (quoted strings).
 * Used to show thumbnails of referenced cards in chat responses.
 */

/** Common single-word keywords that are not card names */
const KEYWORD_ONLY = new Set([
  'mobilize', 'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
  'menace', 'prowess', 'hexproof', 'indestructible', 'first', 'strike', 'double',
  'etb', 'draw', 'ramp', 'sacrifice', 'counter', 'token',
])

/**
 * Extract card names from prompt.
 * 1. Quoted strings: "impact tremors", "warleader's call" (supports curly quotes)
 * 2. Unquoted after "like" or "such as": like impact tremors, warleader's call, and enduring innocence
 * Filters out single-word keywords (e.g. "mobilize") to avoid false positives.
 */
export function extractMentionedCardNames(prompt: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []

  function addName(name: string): boolean {
    const n = name.trim()
    if (!n || n.length < 3) return false
    const lower = n.toLowerCase()
    if (seen.has(lower)) return false
    if (!n.includes(' ') && !n.includes("'") && KEYWORD_ONLY.has(lower)) return false
    seen.add(lower)
    names.push(n)
    return names.length >= 6
  }

  // 1. Quoted strings (normalize curly quotes)
  const normalized = prompt.replace(/\u201C/g, '"').replace(/\u201D/g, '"')
  for (const m of normalized.matchAll(/"([^"]+)"/g)) {
    if (addName(m[1])) return names
  }

  // 2. "cheaper than X", "alternatives to X", "similar to X", "instead of X"
  const refMatch = prompt.match(
    /(?:cheaper\s+(?:cards?\s+)?(?:than|then)|alternatives?\s+to|similar\s+to|instead\s+of)\s+["']?([^"'.]+?)["']?(?:\s|$|\.|,)/i
  )
  if (refMatch) {
    const n = refMatch[1].trim()
    if (n.length >= 4) addName(n)
  }

  // 3. Unquoted: "like X, Y, and Z" or "such as X, Y, and Z"
  const likeMatch = prompt.match(/(?:like|such as)\s+([^.]+?)(?:\.|$|recommend|—)/i)
  if (likeMatch) {
    const phrase = likeMatch[1]
    // Split on comma or " and " - strip surrounding quotes to avoid dupes with quoted extraction
    const parts = phrase.split(/,\s*|\s+and\s+/i)
    for (const part of parts) {
      const n = part.trim().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '').trim()
      if (n.length >= 4 && (n.includes(' ') || n.includes("'"))) {
        if (addName(n)) return names
      }
    }
  }

  // 4. Markdown bold: **Card Name** (common in tables and lists)
  for (const m of prompt.matchAll(/\*\*([^*]+)\*\*/g)) {
    const n = m[1].trim()
    if (n.length >= 4 && (n.includes(' ') || n.includes(',') || n.includes("'"))) {
      if (addName(n)) return names
    }
  }

  // 5. Table rows: | Card Name | ... (first cell often has card name)
  for (const line of prompt.split('\n')) {
    const match = line.match(/^\|?\s*\*\*([^*|]+)\*\*\s*\|/)
    if (match) {
      const n = match[1].trim()
      if (n.length >= 4 && (n.includes(' ') || n.includes(','))) {
        if (addName(n)) return names
      }
    }
  }

  return names
}

