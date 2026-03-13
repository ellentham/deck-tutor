/**
 * Scryfall API client with caching and rate limiting.
 * Per API docs: cache 24h+, 50-100ms between requests, required headers.
 * @see https://scryfall.com/docs/api
 * @see https://scryfall.com/docs/api/bulk-data
 */

import type { Card } from '../types/card'
import type { ScryfallCard, ScryfallList, ScryfallError, BulkDataItem } from './scryfallTypes'
import {
  getCached,
  setCached,
  searchCacheKey,
  namedCacheKey,
  autocompleteCacheKey,
  getBulkCached,
  setBulkCached,
} from './scryfallCache'
import sampleCardsData from '../data/sampleCards.json'

const API_BASE = 'https://api.scryfall.com'
const RATE_LIMIT_MS = 75 // 50-100ms per Scryfall recommendation
const USER_AGENT = 'DeckTutor/1.0 (https://github.com/deck-tutor; contact@example.com)'

let lastRequestTime = 0

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed))
  }
  lastRequestTime = Date.now()

  const response = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  return response
}

function getCardImageUrl(card: ScryfallCard): string {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.image_uris?.large) return card.image_uris.large
  if (card.image_uris?.small) return card.image_uris.small
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large
  return ''
}

/** Get bundled sample cards for immediate display (no async) */
export function getSampleCardsForDisplay(): ScryfallCard[] {
  const list = sampleCardsData as ScryfallList
  return list.data ?? []
}

/** Get oracle text for display (handles double-faced cards) */
function getOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text
  if (card.card_faces?.length) {
    return card.card_faces
      .map((f) => (f.oracle_text ? `${f.name}\n${f.oracle_text}` : f.name))
      .join('\n\n')
  }
  return ''
}

/** Build Scryfall card page URL when API doesn't provide it */
function getScryfallUri(card: ScryfallCard): string {
  if (card.scryfall_uri) return card.scryfall_uri
  return `https://scryfall.com/search?q=!"${encodeURIComponent(card.name)}"`
}

/** Fetch card by name via backend proxy. Returns null if not found or on error. */
export async function fetchCardByName(name: string): Promise<Card | null> {
  try {
    const res = await fetch(`/api/scryfall/card?name=${encodeURIComponent(name)}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      id?: string
      name?: string
      typeLine?: string
      manaCost?: string
      imageUrl?: string
      oracleText?: string
      scryfallUri?: string
    }
    if (data.imageUrl && data.name) {
      return {
        id: data.id ?? data.name,
        name: data.name,
        typeLine: data.typeLine ?? '',
        manaCost: data.manaCost ?? '',
        imageUrl: data.imageUrl,
        oracleText: data.oracleText ?? '',
        scryfallUri: data.scryfallUri ?? '',
      }
    }
    return null
  } catch {
    return null
  }
}

/** Map Scryfall card to our Card interface */
export function toAppCard(card: ScryfallCard): {
  id: string
  name: string
  typeLine: string
  manaCost: string
  imageUrl: string
  oracleText: string
  scryfallUri: string
  colorIdentity: string[]
  priceUsd: number | null
} {
  const priceStr = card.prices?.usd ?? card.prices?.usd_foil ?? null
  const priceUsd = priceStr != null ? parseFloat(priceStr) : null
  return {
    id: card.id,
    name: card.name,
    typeLine: card.type_line ?? '',
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    imageUrl: getCardImageUrl(card),
    oracleText: getOracleText(card),
    scryfallUri: getScryfallUri(card),
    colorIdentity: card.color_identity ?? [],
    priceUsd: Number.isNaN(priceUsd) ? null : priceUsd,
  }
}

/** Search cards with caching */
export async function searchCards(
  query: string,
  page = 1
): Promise<{ cards: ScryfallCard[]; hasMore: boolean; totalCards?: number }> {
  try {
    const cacheKey = searchCacheKey(query, page)
    const cached = await getCached<ScryfallList>(cacheKey)
    if (cached?.data?.length) {
      return { cards: cached.data, hasMore: cached.has_more, totalCards: cached.total_cards }
    }
  } catch {
    // IndexedDB unavailable - continue to API
  }

  const params = new URLSearchParams({ q: query, page: String(page) })
  // Prefer backend proxy to avoid CORS; fall back to direct Scryfall if proxy unavailable
  const proxyUrl = `/api/scryfall/search?${params}`
  const directUrl = `${API_BASE}/cards/search?${params}`
  let response = await rateLimitedFetch(proxyUrl)
  if (!response.ok) {
    response = await rateLimitedFetch(directUrl)
  }

  if (!response.ok) {
    const err = (await response.json()) as ScryfallError
    if (err.object === 'error' && err.code === 'not_found') {
      return { cards: [], hasMore: false, totalCards: 0 }
    }
    throw new Error(err.details ?? `Scryfall API error: ${response.status}`)
  }

  const data = (await response.json()) as ScryfallList
  try {
    await setCached(searchCacheKey(query, page), data)
  } catch {
    // Cache write failed - still return results
  }

  return {
    cards: data.data,
    hasMore: data.has_more,
    totalCards: data.total_cards,
  }
}

/** Get card by exact or fuzzy name with caching */
export async function getCardByName(
  name: string,
  exact = false
): Promise<ScryfallCard | null> {
  try {
    const cacheKey = namedCacheKey(name, exact)
    const cached = await getCached<ScryfallCard | null>(cacheKey)
    if (cached) return cached
  } catch {
    // IndexedDB unavailable - continue to API
  }

  const param = exact ? 'exact' : 'fuzzy'
  const params = new URLSearchParams({ [param]: name })
  const url = `${API_BASE}/cards/named?${params}`
  const response = await rateLimitedFetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      try {
        await setCached(namedCacheKey(name, exact), null)
      } catch {
        /* ignore */
      }
      return null
    }
    const err = (await response.json()) as ScryfallError
    throw new Error(err.details ?? `Scryfall API error: ${response.status}`)
  }

  const data = (await response.json()) as ScryfallCard
  try {
    await setCached(namedCacheKey(name, exact), data)
  } catch {
    /* ignore */
  }
  return data
}

/** Autocomplete card names with caching */
export async function autocomplete(query: string): Promise<string[]> {
  if (!query.trim()) return []

  const cacheKey = autocompleteCacheKey(query)
  const cached = await getCached<string[]>(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({ q: query })
  const url = `${API_BASE}/cards/autocomplete?${params}`
  const response = await rateLimitedFetch(url)

  if (!response.ok) return []

  const data = (await response.json()) as { data: string[] }
  await setCached(cacheKey, data.data)
  return data.data
}

/** Fetch bulk data manifest */
export async function getBulkDataManifest(): Promise<BulkDataItem[]> {
  const response = await rateLimitedFetch(`${API_BASE}/bulk-data`)
  if (!response.ok) throw new Error('Failed to fetch bulk data manifest')
  const data = (await response.json()) as { data: BulkDataItem[] }
  return data.data
}

/** Fetch and cache Oracle Cards bulk data (one card per Oracle ID, ~162MB) */
export async function fetchOracleCardsBulk(): Promise<ScryfallCard[]> {
  const cached = await getBulkCached<ScryfallCard[]>('oracle-cards')
  if (cached) return cached

  const manifest = await getBulkDataManifest()
  const oracleItem = manifest.find((m) => m.type === 'oracle_cards')
  if (!oracleItem) throw new Error('Oracle cards bulk data not found')

  const response = await fetch(oracleItem.download_uri, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Failed to download Oracle cards bulk data')

  const cards = (await response.json()) as ScryfallCard[]
  await setBulkCached('oracle-cards', cards)
  return cards
}

/** Check if Oracle Cards bulk data is cached locally */
export async function hasOracleCardsCached(): Promise<boolean> {
  const cached = await getBulkCached<ScryfallCard[]>('oracle-cards')
  return cached !== null && cached.length > 0
}

/**
 * Search locally in cached Oracle Cards bulk data.
 * Use when bulk data is available to avoid API calls.
 */
export async function searchLocalBulk(
  query: string,
  limit = 2000
): Promise<ScryfallCard[]> {
  const cards = await getBulkCached<ScryfallCard[]>('oracle-cards')
  if (!cards || cards.length === 0) return []

  const q = query.toLowerCase().trim()
  if (!q) return []

  const matches: ScryfallCard[] = []
  for (const card of cards) {
    if (matches.length >= limit) break
    const name = card.name.toLowerCase()
    if (name.includes(q) || q.split(/\s+/).every((w) => name.includes(w))) {
      matches.push(card)
    }
  }
  return matches
}

/** Search terms to pre-seed in cache for testing */
const SAMPLE_SEED_QUERIES = [
  'lightning bolt',
  'lightning',
  'bolt',
  'counterspell',
  'birds of paradise',
  'birds',
  'dark ritual',
  'sol ring',
  'sol',
  'creature',
  'instant',
  'red',
  'blue',
  'green',
  'black',
  'white',
]

/**
 * Seed the cache with bundled sample cards so the app works for testing
 * without requiring API calls. Call once on app init.
 */
export async function seedCacheWithSampleData(): Promise<void> {
  const list = sampleCardsData as ScryfallList
  const cards = list.data ?? []
  if (cards.length === 0) return

  const listEntry: ScryfallList = {
    object: 'list',
    has_more: false,
    data: cards,
  }

  for (const query of SAMPLE_SEED_QUERIES) {
    await setCached(searchCacheKey(query, 1), listEntry)
  }

  // Seed named lookups for commander-style prompts (e.g. "Maralen, Fae Ascendant as the commander")
  for (const card of cards) {
    const name = card.name.toLowerCase()
    await setCached(namedCacheKey(name, false), card)
    await setCached(namedCacheKey(name, true), card)
    // Also seed without comma for "maralen fae ascendant"
    const noComma = name.replace(/,/g, '')
    if (noComma !== name) {
      await setCached(namedCacheKey(noComma.trim(), false), card)
    }
  }
}

const COLOR_LETTERS: Record<string, string> = {
  r: 'red',
  u: 'blue',
  g: 'green',
  b: 'black',
  w: 'white',
}

/**
 * Fallback: fuzzy match query against bundled sample cards.
 * Matches on card name, type line, oracle text, and color.
 */
function searchSampleCards(query: string, limit: number): ScryfallCard[] {
  const list = sampleCardsData as ScryfallList
  const cards = list.data ?? []
  const q = query.toLowerCase().trim()
  if (!q || cards.length === 0) return []

  const matches: ScryfallCard[] = []
  const words = q.split(/\s+/).filter((w) => w.length > 0)

  for (const card of cards) {
    if (matches.length >= limit) break
    const name = card.name.toLowerCase()
    const typeLine = (card.type_line ?? '').toLowerCase()
    const oracleText = (card.oracle_text ?? '').toLowerCase()
    const colorIds = card.colors ?? card.color_identity ?? []
    const colorNames = colorIds
      .map((c: string) => COLOR_LETTERS[c.toLowerCase()] ?? c.toLowerCase())
      .join(' ')
    const searchable = `${name} ${typeLine} ${oracleText} ${colorIds.join(' ')} ${colorNames}`

    // Match if query or all words appear in searchable text
    if (searchable.includes(q) || words.every((w) => searchable.includes(w))) {
      matches.push(card)
    }
  }

  return matches
}

/**
 * Search using parsed prompt (card names, commander context, etc.).
 * Uses Scryfall named API when a specific card is identified, otherwise search.
 */
export async function searchFromParsedPrompt(
  parsed: { cardNames: string[]; searchQuery: string; useNamedLookup: boolean },
  options?: { preferLocal?: boolean; limit?: number }
): Promise<SearchResult> {
  const { preferLocal = true, limit = 2000 } = options ?? {}

  // Named lookup: "Maralen, Fae Ascendant as the commander" -> get that exact card
  if (parsed.useNamedLookup && parsed.cardNames.length > 0) {
    try {
      const card = await getCardByName(parsed.cardNames[0], false)
      if (card) return { cards: [card], totalCards: 1 }
    } catch {
      // API failed - fall back to sample data
      const fallback = searchSampleCards(parsed.cardNames[0], 1)
      if (fallback.length > 0) return { cards: fallback, totalCards: fallback.length }
    }
    return { cards: [] }
  }

  // For semantic queries (not named lookup), skip local bulk - it only matches card names.
  // Use Scryfall API directly so o:, t:, c:, etc. work correctly.
  const useApiForSemantic = !parsed.useNamedLookup
  return searchCardsUnified(parsed.searchQuery, {
    preferLocal: useApiForSemantic ? false : preferLocal,
    limit,
  })
}

/** Search with a raw Scryfall query (bypasses parser). Use for LLM-generated queries. */
export async function searchByQuery(
  query: string,
  options?: { limit?: number }
): Promise<SearchResult> {
  const { limit = 2000 } = options ?? {}
  return searchCardsUnified(query.trim(), { preferLocal: false, limit })
}

/**
 * Unified search: uses local bulk data when cached, otherwise Scryfall API.
 * Always falls back to bundled sample when API returns empty or fails.
 */
export interface SearchResult {
  cards: ScryfallCard[]
  totalCards?: number
}

export async function searchCardsUnified(
  query: string,
  options?: { preferLocal?: boolean; limit?: number }
): Promise<SearchResult> {
  const { preferLocal = true, limit = 2000 } = options ?? {}
  const q = query.trim()
  if (!q) return { cards: [] }

  // 1. Try local bulk cache
  if (preferLocal) {
    try {
      const local = await searchLocalBulk(q, limit)
      if (local.length > 0) return { cards: local, totalCards: local.length }
    } catch {
      // IndexedDB may be unavailable (private mode, etc.)
    }
  }

  // 2. Try API (with cache), fetch multiple pages if needed
  try {
    const allCards: ScryfallCard[] = []
    let totalCards: number | undefined
    let page = 1
    let hasMore = true
    while (hasMore && allCards.length < limit) {
      const result = await searchCards(q, page)
      const { cards, hasMore: more, totalCards: tc } = result
      if (page === 1 && tc !== undefined) totalCards = tc
      allCards.push(...cards)
      hasMore = more && cards.length > 0
      page++
      if (cards.length === 0) break
    }
    if (allCards.length > 0) return { cards: allCards.slice(0, limit), totalCards }
  } catch {
    // API failed (network, CORS, etc.)
  }

  // 3. Always fall back to bundled sample when empty
  // Extract meaningful terms from Scryfall syntax for sample matching (o:ramp → ramp, c:g → green)
  const fallbackTerms = extractSearchTermsFromScryfallQuery(q)
  const sampleCards = searchSampleCards(fallbackTerms, limit)
  return { cards: sampleCards, totalCards: sampleCards.length }
}

/** Extract searchable terms from Scryfall query for fallback sample matching */
function extractSearchTermsFromScryfallQuery(query: string): string {
  const terms: string[] = []
  const colorMap: Record<string, string> = { g: 'green', r: 'red', u: 'blue', b: 'black', w: 'white' }
  // Match o:term, t:term, c:term, kw:term - capture the term part
  const matches = query.matchAll(/(?:o|oracle|t|type|c|color|kw|keyword):([^\s()]+)/gi)
  for (const m of matches) {
    const term = m[1].replace(/^["']|["']$/g, '')
    if (term.length <= 2 && colorMap[term.toLowerCase()]) {
      terms.push(colorMap[term.toLowerCase()])
    } else {
      terms.push(term)
    }
  }
  return terms.length > 0 ? terms.join(' ') : query
}
