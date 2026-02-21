import type { Card } from '../components/CardGrid'

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

/** Sort cards by relevance: AI-vetted (with reason) first, then by CMC, then by name */
export function sortByRelevance(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aHasReason = Boolean(a.reason?.trim())
    const bHasReason = Boolean(b.reason?.trim())
    if (aHasReason !== bHasReason) return aHasReason ? -1 : 1
    const aCost = parseManaValue(a.manaCost)
    const bCost = parseManaValue(b.manaCost)
    if (aCost !== bCost) return aCost - bCost
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
}
