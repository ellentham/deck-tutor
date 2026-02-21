/**
 * Strategy extraction from MTG card oracle text.
 * Identifies creature types, mechanics, triggers, and power/toughness
 * to build Scryfall query fragments for deck-building.
 */

const SCRYFALL_NAMED = 'https://api.scryfall.com/cards/named'

export interface ExtractedStrategy {
  cardName: string
  colorIdentity: string[]
  colorIdentityScryfall: string
  creatureTypes: string[]
  mechanics: string[]
  triggers: string[]
  powerToughness?: { power?: number; toughness?: number }
  scryfallQueryFragments: string[]
  suggestedQuery: string
}

/** Creature types commonly referenced in oracle text */
const CREATURE_TYPE_PATTERNS = [
  /\b(?:Angel|Demon|Dragon)s?\b/gi,
  /\b(?:Elf|Faerie|Goblin|Vampire|Squirrel|Human|Wizard|Warrior)s?\b/gi,
  /\b(?:Dragon|Elemental|Horror|Phyrexian)s?\b/gi,
  /\b(?:Bird|Beast|Spirit|Zombie)s?\b/gi,
]

/** Mechanics to detect in oracle text */
const MECHANIC_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\+1\/\+1\s*counter/gi, term: 'o:"+1/+1"' },
  { pattern: /\bproliferate\b/i, term: 'o:proliferate' },
  { pattern: /\b(?:create|put)\s+.*\s+token/i, term: 'o:token' },
  { pattern: /\btoken\s+(?:creature|creatures)/i, term: 'o:token' },
  { pattern: /\bsacrifice\b/i, term: 'o:sacrifice' },
  { pattern: /\bdraw\s+(?:a\s+)?card/i, term: 'o:draw' },
  { pattern: /\bexile\b/i, term: 'o:exile' },
  { pattern: /\bcounter\b/i, term: 'o:counter' },
]

/** Trigger patterns */
const TRIGGER_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /whenever\s+you\s+cast/i, term: 'o:"whenever you cast"' },
  { pattern: /whenever\s+.*\s+enters\s+the\s+battlefield/i, term: 'o:"enters the battlefield"' },
  { pattern: /whenever\s+.*\s+attack/i, term: 'o:attack' },
  { pattern: /when\s+.*\s+attacks/i, term: 'o:attack' },
]

function colorIdentityToScryfall(colors: string[]): string {
  const map: Record<string, string> = {
    W: 'w',
    U: 'u',
    B: 'b',
    R: 'r',
    G: 'g',
  }
  const letters = (colors || []).map((c) => map[c?.toUpperCase()] ?? c?.toLowerCase()).filter(Boolean)
  return letters.join('')
}

function extractCreatureTypes(text: string, typeLine: string): string[] {
  const seen = new Set<string>()
  const combined = `${text} ${typeLine}`.toLowerCase()

  for (const re of CREATURE_TYPE_PATTERNS) {
    const matches = combined.match(re)
    if (matches) {
      for (const m of matches) {
        const normalized = m.replace(/s$/, '') // "Dragons" -> "Dragon"
        if (normalized.length > 2) seen.add(normalized.toLowerCase())
      }
    }
  }
  return [...seen]
}

function extractMechanics(text: string): string[] {
  const terms: string[] = []
  for (const { pattern, term } of MECHANIC_PATTERNS) {
    if (pattern.test(text) && !terms.includes(term)) terms.push(term)
  }
  return terms
}

function extractTriggers(text: string): string[] {
  const terms: string[] = []
  for (const { pattern, term } of TRIGGER_PATTERNS) {
    if (pattern.test(text) && !terms.includes(term)) terms.push(term)
  }
  return terms
}

function extractPowerToughness(text: string): { power?: number; toughness?: number } | undefined {
  // "base power 1" (Zinnia), "power 1" (creatures with power 1)
  const basePower1 = /\b(?:base\s+)?power\s+1\b/i.test(text)
  if (basePower1) return { power: 1 }
  return undefined
}

export async function fetchCardFromScryfall(cardName: string): Promise<{
  name: string
  oracle_text: string
  type_line: string
  color_identity: string[]
  power?: string
  toughness?: string
} | null> {
  const params = new URLSearchParams({ fuzzy: cardName })
  const res = await fetch(`${SCRYFALL_NAMED}?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const card = (await res.json()) as {
    name?: string
    oracle_text?: string
    type_line?: string
    color_identity?: string[]
    power?: string
    toughness?: string
    card_faces?: Array<{ oracle_text?: string }>
  }
  const oracleText = card.oracle_text ?? card.card_faces?.map((f) => f.oracle_text).join('\n') ?? ''
  return {
    name: card.name ?? '',
    oracle_text: oracleText,
    type_line: card.type_line ?? '',
    color_identity: card.color_identity ?? [],
    power: card.power,
    toughness: card.toughness,
  }
}

export function extractStrategyFromCard(card: {
  name: string
  oracle_text: string
  type_line: string
  color_identity: string[]
  power?: string
  toughness?: string
}): ExtractedStrategy {
  const text = card.oracle_text
  const typeLine = card.type_line

  const creatureTypes = extractCreatureTypes(text, typeLine)
  const mechanics = extractMechanics(text)
  const triggers = extractTriggers(text)
  const powerToughness = extractPowerToughness(text)

  const colorIdentityScryfall = colorIdentityToScryfall(card.color_identity)

  const scryfallQueryFragments: string[] = []

  if (creatureTypes.length > 0) {
    if (creatureTypes.length === 1) {
      scryfallQueryFragments.push(`t:${creatureTypes[0]}`)
    } else {
      scryfallQueryFragments.push(`(${creatureTypes.map((t) => `t:${t}`).join(' OR ')})`)
    }
  }
  scryfallQueryFragments.push(...mechanics, ...triggers)
  if (powerToughness?.power !== undefined) {
    scryfallQueryFragments.push(`pow:${powerToughness.power}`)
  }
  if (colorIdentityScryfall) {
    scryfallQueryFragments.push(`id:${colorIdentityScryfall}`)
  }

  const suggestedQuery = scryfallQueryFragments.join(' ').trim() || '(no strategy fragments extracted)'

  return {
    cardName: card.name,
    colorIdentity: card.color_identity,
    colorIdentityScryfall,
    creatureTypes,
    mechanics,
    triggers,
    powerToughness,
    scryfallQueryFragments,
    suggestedQuery,
  }
}

export async function extractStrategyFromCardName(cardName: string): Promise<ExtractedStrategy | null> {
  const card = await fetchCardFromScryfall(cardName)
  if (!card) return null
  return extractStrategyFromCard(card)
}
