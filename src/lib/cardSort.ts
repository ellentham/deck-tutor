import type { Card } from '../types/card'

/** Parse mana cost string to approximate CMC (e.g. "{2}{G}" → 3) */
export function parseManaValue(cost: string | undefined): number {
  if (!cost?.trim()) return 0
  let total = 0
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const sym = m[1].toUpperCase()
    if (sym === 'X' || sym === 'Y' || sym === 'Z') continue
    const num = parseInt(sym, 10)
    total += Number.isNaN(num) ? 1 : num
  }
  return total
}

/**
 * Extract card names from the LLM's markdown response, in order of appearance.
 * Captures bold names (**Card Name**), table cells (| **Card Name** |), and header mentions.
 */
export function extractRecommendedOrder(markdown: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []

  for (const m of markdown.matchAll(/\*\*([^*|]+)\*\*/g)) {
    const name = m[1].trim()
    if (name.length < 3) continue
    const lower = name.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    names.push(lower)
  }
  return names
}

/**
 * Assign recommendedRank to cards based on their position in the LLM's response.
 * Cards named first by the LLM get rank 0, 1, 2, etc.
 */
export function applyRecommendedRanks(cards: Card[], llmMessage: string): Card[] {
  const order = extractRecommendedOrder(llmMessage)
  if (order.length === 0) return cards
  const rankMap = new Map(order.map((name, i) => [name, i]))

  return cards.map((card) => {
    const lower = card.name.trim().toLowerCase()
    const rank = rankMap.get(lower) ?? rankMap.get(lower.split(' // ')[0].trim())
    return rank !== undefined ? { ...card, recommendedRank: rank } : card
  })
}

/**
 * Sort cards by recommendation strength:
 * 1. LLM-recommended cards first, in recommendation order
 * 2. Cards with AI reasons next
 * 3. Remaining cards by CMC, then name
 */
export function sortByRelevance(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aRank = a.recommendedRank
    const bRank = b.recommendedRank
    const aHasRank = aRank !== undefined
    const bHasRank = bRank !== undefined

    if (aHasRank !== bHasRank) return aHasRank ? -1 : 1
    if (aHasRank && bHasRank) return aRank - bRank

    const aHasReason = Boolean(a.reason?.trim())
    const bHasReason = Boolean(b.reason?.trim())
    if (aHasReason !== bHasReason) return aHasReason ? -1 : 1

    const aCost = parseManaValue(a.manaCost)
    const bCost = parseManaValue(b.manaCost)
    if (aCost !== bCost) return aCost - bCost
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
}

export type SortOption =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'color-identity'
  | 'mana-asc'
  | 'price-asc'
  | 'price-desc'

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const

function getColorIdentitySortKey(card: Card): number {
  const ids = card.colorIdentity ?? []
  if (ids.length === 0) return 6 // colorless last
  if (ids.length > 1) return 5 // multicolor before colorless
  const idx = COLOR_ORDER.indexOf(ids[0] as (typeof COLOR_ORDER)[number])
  return idx >= 0 ? idx : 5
}

export function sortCardsBy(cards: Card[], option: SortOption): Card[] {
  switch (option) {
    case 'default':
      return sortByRelevance(cards)
    case 'name-asc':
      return [...cards].sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
      )
    case 'name-desc':
      return [...cards].sort((a, b) =>
        (b.name ?? '').localeCompare(a.name ?? '', undefined, { sensitivity: 'base' })
      )
    case 'color-identity':
      return [...cards].sort((a, b) => {
        const ka = getColorIdentitySortKey(a)
        const kb = getColorIdentitySortKey(b)
        if (ka !== kb) return ka - kb
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
      })
    case 'mana-asc':
      return [...cards].sort((a, b) => {
        const va = parseManaValue(a.manaCost)
        const vb = parseManaValue(b.manaCost)
        if (va !== vb) return va - vb
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
      })
    case 'price-asc':
      return [...cards].sort((a, b) => {
        const pa = a.priceUsd ?? Infinity
        const pb = b.priceUsd ?? Infinity
        if (pa !== pb) return pa - pb
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
      })
    case 'price-desc':
      return [...cards].sort((a, b) => {
        const pa = a.priceUsd ?? -1
        const pb = b.priceUsd ?? -1
        if (pa !== pb) return pb - pa
        return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
      })
    default:
      return sortByRelevance(cards)
  }
}

export function filterCardsByColors(cards: Card[], selectedColors: Set<string>): Card[] {
  if (selectedColors.size === 0) return cards
  return cards.filter((card) => {
    const ids = card.colorIdentity ?? []
    if (ids.length === 0) return selectedColors.has('C')
    return ids.some((c) => selectedColors.has(c))
  })
}

export function filterCardsByReasons(cards: Card[], selectedReasons: Set<string>): Card[] {
  if (selectedReasons.size === 0) return cards
  return cards.filter((card) => {
    const r = card.reason?.trim()
    if (!r) return false
    return selectedReasons.has(r)
  })
}
