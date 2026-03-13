#!/usr/bin/env node
/**
 * Deck Tutor API server
 * Provides LLM-powered prompt-to-Scryfall conversion with MCP resources as context.
 * Run with: npx tsx server/index.ts
 *
 * Set API keys in .env (copy from .env.example)
 */

import 'dotenv/config'
import express from 'express'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCES_DIR = join(__dirname, 'context')

const app = express()
app.use(express.json())

async function loadMCPContext(): Promise<string> {
  const parts: string[] = []
  try {
    const synergy = await readFile(join(RESOURCES_DIR, 'synergy-criteria.md'), 'utf-8')
    parts.push('## Synergy Criteria\n' + synergy)
  } catch {
    /* ignore */
  }
  try {
    const commander = await readFile(join(RESOURCES_DIR, 'format-rules', 'commander.md'), 'utf-8')
    parts.push('## Commander Format Rules\n' + commander)
  } catch {
    /* ignore */
  }
  try {
    const standard = await readFile(join(RESOURCES_DIR, 'format-rules', 'standard.md'), 'utf-8')
    parts.push('## Standard Format Rules\n' + standard)
  } catch {
    /* ignore */
  }
  try {
    const comparison = await readFile(join(RESOURCES_DIR, 'comparison-priorities.md'), 'utf-8')
    parts.push('## Comparison Priorities\n' + comparison)
  } catch {
    /* ignore */
  }
  try {
    const strategy = await readFile(join(RESOURCES_DIR, 'strategy-examples.md'), 'utf-8')
    parts.push('## Strategy Extraction Examples\n' + strategy)
  } catch {
    /* ignore */
  }
  try {
    const keywords = await readFile(join(RESOURCES_DIR, 'scryfall-keywords.md'), 'utf-8')
    parts.push('## Scryfall Keyword Search\n' + keywords)
  } catch {
    /* ignore */
  }
  return parts.join('\n\n')
}

/** Health check - frontend can verify backend is running */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llm: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) })
})

/** Get total card count from Scryfall (for welcome subtitle) */
app.get('/api/scryfall/count', async (_req, res) => {
  try {
    const scryRes = await fetch(
      'https://api.scryfall.com/cards/search?q=*&page=1&format=json',
      { headers: { Accept: 'application/json' } }
    )
    const data = (await scryRes.json()) as { total_cards?: number }
    const total = typeof data.total_cards === 'number' ? data.total_cards : null
    res.json({ total_cards: total })
  } catch (err) {
    console.error('Scryfall count error:', err)
    res.status(502).json({ total_cards: null })
  }
})

/** Proxy Scryfall named/fuzzy card lookup (for mentioned-card thumbnails + detail modal) */
app.get('/api/scryfall/card', async (req, res) => {
  const name = req.query.name
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Missing name parameter' })
    return
  }
  try {
    const params = new URLSearchParams({ fuzzy: name.trim() })
    const scryRes = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
      headers: { Accept: 'application/json' },
    })
    const data = (await scryRes.json()) as {
      id?: string
      name?: string
      type_line?: string
      mana_cost?: string
      oracle_text?: string
      scryfall_uri?: string
      image_uris?: { small?: string; normal?: string }
      card_faces?: Array<{ oracle_text?: string; image_uris?: { normal?: string }; mana_cost?: string }>
    }
    if (!scryRes.ok) {
      res.status(404).json({ error: 'Card not found' })
      return
    }
    const imageUrl =
      data.image_uris?.normal ??
      data.image_uris?.small ??
      data.card_faces?.[0]?.image_uris?.normal ??
      data.card_faces?.[0]?.image_uris?.normal ??
      ''
    const oracleText = data.oracle_text ?? data.card_faces?.map((f) => f.oracle_text).filter(Boolean).join('\n\n') ?? ''
    res.json({
      id: data.id ?? data.name,
      name: data.name ?? '',
      typeLine: data.type_line ?? '',
      manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
      imageUrl,
      oracleText,
      scryfallUri: data.scryfall_uri ?? `https://scryfall.com/search?q=!"${encodeURIComponent(data.name ?? '')}"`,
    })
  } catch (err) {
    console.error('Scryfall card lookup error:', err)
    res.status(502).json({ error: 'Scryfall request failed' })
  }
})

interface AppCard {
  id: string
  name: string
  typeLine: string
  manaCost: string
  imageUrl: string
  oracleText: string
  scryfallUri: string
  colorIdentity: string[]
  priceUsd: number | null
  reason?: string
  recommendedRank?: number
}

function mapScryfallToAppCard(c: {
  id?: string
  name?: string
  type_line?: string
  mana_cost?: string
  oracle_text?: string
  image_uris?: { normal?: string; small?: string }
  card_faces?: Array<{ oracle_text?: string; mana_cost?: string; image_uris?: { normal?: string } }>
  scryfall_uri?: string
  color_identity?: string[]
  prices?: { usd?: string | null; usd_foil?: string | null }
}): AppCard {
  const imageUrl =
    c.image_uris?.normal ?? c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.normal ?? ''
  const oracleText =
    c.oracle_text ?? c.card_faces?.map((f) => f.oracle_text).filter(Boolean).join('\n\n') ?? ''
  const priceStr = c.prices?.usd ?? c.prices?.usd_foil ?? null
  const priceUsd = priceStr != null ? parseFloat(priceStr) : null
  return {
    id: c.id ?? c.name ?? '',
    name: c.name ?? '',
    typeLine: c.type_line ?? '',
    manaCost: c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? '',
    imageUrl,
    oracleText,
    scryfallUri: c.scryfall_uri ?? `https://scryfall.com/search?q=!"${encodeURIComponent(c.name ?? '')}"`,
    colorIdentity: c.color_identity ?? [],
    priceUsd: Number.isNaN(priceUsd as number) ? null : priceUsd,
  }
}

async function fetchScryfallSearch(query: string, limit: number): Promise<{ cards: AppCard[]; totalCards?: number }> {
  const all: AppCard[] = []
  let page = 1
  let totalCards: number | undefined
  while (all.length < limit) {
    const params = new URLSearchParams({ q: query.trim(), page: String(page) })
    const res = await fetch(`https://api.scryfall.com/cards/search?${params}`, {
      headers: { Accept: 'application/json' },
    })
    const data = (await res.json()) as { data?: unknown[]; has_more?: boolean; total_cards?: number; object?: string; code?: string }
    if (!res.ok || !Array.isArray(data.data)) {
      if (data?.object === 'error' && data?.code === 'not_found') {
        return { cards: [], totalCards: 0 }
      }
      throw new Error('Scryfall search failed')
    }
    if (page === 1 && typeof data.total_cards === 'number') totalCards = data.total_cards
    const batch = (data.data as Record<string, unknown>[]).map((c) => mapScryfallToAppCard(c as Parameters<typeof mapScryfallToAppCard>[0]))
    all.push(...batch)
    if (!data.has_more || batch.length === 0) break
    page++
    await sleep(75)
  }
  return { cards: all.slice(0, limit), totalCards }
}

/**
 * Assign recommendedRank based on first mention in the chat message.
 * Cards mentioned earlier in the LLM's response appear first in the list.
 * Matches both **bold** names and plain text (e.g. "built around Zoraline, Cosmos Caller").
 * Process longer names first so "Lightning Bolt" matches before "Bolt".
 */
function applyRecommendedRanks(cards: AppCard[], markdown: string): AppCard[] {
  const text = markdown.toLowerCase()
  if (!text.trim()) return cards

  // Find first occurrence of each card name in the message
  const idToIndex = new Map<string, number>()
  const byLen = [...cards].sort((a, b) => b.name.length - a.name.length)
  for (const card of byLen) {
    const name = card.name.trim().toLowerCase()
    const part = name.split(' // ')[0].trim()
    const idx = Math.min(
      text.includes(name) ? text.indexOf(name) : Infinity,
      text.includes(part) ? text.indexOf(part) : Infinity
    )
    if (idx < Infinity && !idToIndex.has(card.id)) {
      idToIndex.set(card.id, idx)
    }
  }

  // Assign rank by order of first mention (earlier = lower rank)
  const sorted = [...idToIndex.entries()].sort((a, b) => a[1] - b[1])
  const idToRank = new Map(sorted.map(([id], i) => [id, i]))

  return cards.map((card) => {
    const rank = idToRank.get(card.id)
    return rank !== undefined ? { ...card, recommendedRank: rank } : card
  })
}

function parseManaValue(cost: string): number {
  if (!cost?.trim()) return 0
  let total = 0
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const sym = (m[1] as string).toUpperCase()
    if (sym === 'X' || sym === 'Y' || sym === 'Z') continue
    const num = parseInt(sym, 10)
    total += Number.isNaN(num) ? 1 : num
  }
  return total
}

function sortCardsByRelevance(cards: AppCard[]): AppCard[] {
  return [...cards].sort((a, b) => {
    const aRank = a.recommendedRank
    const bRank = b.recommendedRank
    const aHasRank = aRank !== undefined
    const bHasRank = bRank !== undefined
    if (aHasRank !== bHasRank) return aHasRank ? -1 : 1
    if (aHasRank && bHasRank) return aRank! - bRank!
    const aHasReason = Boolean(a.reason?.trim())
    const bHasReason = Boolean(b.reason?.trim())
    if (aHasReason !== bHasReason) return aHasReason ? -1 : 1
    const aCost = parseManaValue(a.manaCost)
    const bCost = parseManaValue(b.manaCost)
    if (aCost !== bCost) return aCost - bCost
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
}

/** Proxy Scryfall search to avoid CORS when frontend calls from browser */
app.get('/api/scryfall/search', async (req, res) => {
  const q = req.query.q
  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Missing query parameter q' })
    return
  }
  try {
    const params = new URLSearchParams({ q: q.trim(), page: String(req.query.page || 1) })
    const scryRes = await fetch(`https://api.scryfall.com/cards/search?${params}`, {
      headers: { Accept: 'application/json' },
    })
    const data = (await scryRes.json()) as { data?: unknown[]; object?: string }
    if (!scryRes.ok) {
      res.status(scryRes.status).json(data)
      return
    }
    const count = data.data?.length ?? 0
    if (count > 0) console.error(`[Scryfall] q="${q.slice(0, 60)}..." → ${count} cards`)
    res.json(data)
  } catch (err) {
    console.error('Scryfall proxy error:', err)
    res.status(502).json({ error: 'Scryfall request failed' })
  }
})

const KEYWORD_ONLY = new Set([
  'mobilize', 'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
  'menace', 'prowess', 'hexproof', 'indestructible', 'first', 'strike', 'double',
  'etb', 'draw', 'ramp', 'sacrifice', 'counter', 'token',
])

function extractCardNamesFromPrompt(prompt: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  function add(raw: string): boolean {
    const n = raw.trim()
    if (!n || n.length < 3) return false
    const lower = n.toLowerCase()
    if (seen.has(lower)) return false
    if (!n.includes(' ') && !n.includes("'") && KEYWORD_ONLY.has(lower)) return false
    seen.add(lower)
    names.push(n)
    return names.length >= 6
  }

  const normalized = prompt.replace(/\u201C/g, '"').replace(/\u201D/g, '"')
  for (const m of normalized.matchAll(/"([^"]+)"/g)) {
    if (add(m[1])) return names
  }

  const refMatch = prompt.match(
    /(?:cheaper\s+(?:cards?\s+)?(?:than|then)|alternatives?\s+to|similar\s+to|instead\s+of)\s+["']?([^"'.]+?)["']?(?:\s|$|\.|,)/i
  )
  if (refMatch) add(refMatch[1].trim())

  const likeMatch = prompt.match(/(?:like|such as)\s+([^.]+?)(?:\.|$|recommend|—)/i)
  if (likeMatch) {
    for (const part of likeMatch[1].split(/,\s*|\s+and\s+/i)) {
      const n = part.trim().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '').trim()
      if (n.length >= 4 && (n.includes(' ') || n.includes("'"))) {
        if (add(n)) return names
      }
    }
  }

  return names
}

interface ScryfallCardData {
  name: string
  typeLine: string
  manaCost: string
  oracleText: string
  legalities: Record<string, string>
  keywords: string[]
  colorIdentity: string[]
}

async function lookupCardsOnScryfall(names: string[]): Promise<ScryfallCardData[]> {
  const results: ScryfallCardData[] = []
  for (const name of names) {
    try {
      const params = new URLSearchParams({ fuzzy: name.trim() })
      const res = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        name?: string
        type_line?: string
        mana_cost?: string
        oracle_text?: string
        card_faces?: Array<{ oracle_text?: string; mana_cost?: string }>
        legalities?: Record<string, string>
        keywords?: string[]
        color_identity?: string[]
      }
      if (!data.name) continue
      results.push({
        name: data.name,
        typeLine: data.type_line ?? '',
        manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
        oracleText: data.oracle_text ?? data.card_faces?.map((f) => f.oracle_text).filter(Boolean).join('\n\n') ?? '',
        legalities: data.legalities ?? {},
        keywords: data.keywords ?? [],
        colorIdentity: data.color_identity ?? [],
      })
      await sleep(75)
    } catch {
      continue
    }
  }
  return results
}

function formatCardContext(cards: ScryfallCardData[]): string {
  if (cards.length === 0) return ''
  const sections = cards.map((c) => {
    const legalFormats = Object.entries(c.legalities)
      .filter(([, v]) => v === 'legal')
      .map(([k]) => k)
    return [
      `### ${c.name}`,
      `- Type: ${c.typeLine}`,
      `- Mana: ${c.manaCost}`,
      `- Oracle: ${c.oracleText}`,
      c.keywords.length > 0 ? `- Keywords: ${c.keywords.join(', ')}` : null,
      `- Color identity: ${c.colorIdentity.join(', ') || 'colorless'}`,
      `- Legal in: ${legalFormats.join(', ') || 'no formats'}`,
    ].filter(Boolean).join('\n')
  })
  return `\n\n## Cards mentioned by user (live Scryfall data — use this for legality and oracle text, not your training data)\n${sections.join('\n\n')}`
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering deck-building assistant. Convert the user's natural language request into a Scryfall search query.

CRITICAL - Format legality:
When the user mentions specific cards, their actual Scryfall data (including format legality) will be provided below under "Cards mentioned by user". Use ONLY this data for legality claims—never rely on your training data, which is frequently outdated due to set rotations, bans, and errata. If card data is not provided, do not make legality claims. The Scryfall f:format filter in your queries also ensures only legal cards appear in search results.

Scryfall syntax reference:
- o: or oracle: - oracle text (e.g. o:draw, o:ramp)
- t: or type: - card type AND subtypes (e.g. t:creature, t:elf, t:faerie)
- c: or id: - color/identity (w,u,b,r,g; id:ubg = black/green/blue)
- kw: or keyword: - keyword abilities (e.g. kw:flying, kw:mobilize). When the user mentions ANY specific keyword (flying, mobilize, lifelink, haste, prowess, etc.), ALWAYS use kw:keyword in the query.
- pow: / tou: - power/toughness (e.g. pow:1, tou>=4)
- is:commander - commander-legal cards
- f:format - format (commander, modern, etc.)
- order:edhrec - sort by EDHREC popularity (use for Commander)
- Use OR for alternatives: (t:elf OR t:faerie)
- Use quotes for phrases: o:"enters the battlefield"
- usd<X / usd>X - price filter (e.g. usd<10 for under $10)
- cheapest:usd - prefer cheapest print per card
- order:usd - sort by price; use dir:asc for cheapest first
- function:X or oracletag:X - card function (e.g. function:tutor, function:removal, function:draw)

CRITICAL - Keyword abilities (flying, mobilize, lifelink, haste, prowess, vigilance, etc.):
When the user asks for cards with a specific keyword or mentions cards that have keywords in their oracle text, you MUST include kw:keyword in the scryfallQuery. Do NOT use o:keyword—use kw:keyword. Extract keywords from the oracle text of any cards the user mentions. Do NOT add type filters (t:enchantment, t:creature, etc.) unless the user explicitly asks for a type. If the user mentions two enchantments with vigilance and mobilize, query kw:vigilance kw:mobilize (or OR as appropriate)—NOT t:enchantment. Type filters exclude valid results (e.g. creatures with vigilance).

CRITICAL - "Cheaper alternatives" / "similar in function to [card]":
When the user asks for cheaper cards similar to a named card (e.g. "cheaper than Demonic Tutor", "budget alternatives to Rhystic Study"):
1. Derive the card's function and encode as oracle text or function tag:
   - Tutors → function:tutor or o:"search your library"
   - Draw → function:draw or o:draw
   - Removal → function:removal or o:destroy / o:exile
   - Ramp → o:ramp or o:"add" and o:mana
   - Similar oracle text often indicates similar function; use o:"key phrase" with the distinctive wording
2. Use the card's color identity (id:b for Demonic Tutor)
3. Add price filter: usd<30 for expensive staples, usd<10 for budget, usd<5 for very budget
4. Exclude the original card: -!"Demonic Tutor"
5. Prefer function: when available; otherwise oracle text (o:) works well for matching similar effects

CRITICAL - Extract strategy from commander oracle text:
When the user names a commander, derive ALL relevant strategy elements from its oracle text and encode them in the query:

- **Tribal/creature types**: Maralen mentions Elf, Faerie → (t:elf OR t:faerie)
- **Mechanics**: Animar cares about +1/+1 counters → o:"+1/+1" or o:counter; sacrifice decks → o:sacrifice; draw matters → o:draw
- **Power/toughness**: Zinnia gets +X/+0 for creatures with base power 1 → pow:1 or pow=1; commanders that care about toughness → tou:
- **Triggers**: "whenever you cast" → o:"whenever you cast"; "enters the battlefield" → o:"enters the battlefield"

Always use id: or c: to restrict to the commander's colors.

CRITICAL - "Powerful" or "strong" cards:
Interpret as cards with significant oracle text that synergizes: o:draw, o:sacrifice, o:counter, o:enters, etc. Prefer cards with multiple abilities or strong triggers. Use order:edhrec for Commander to surface popular, proven cards.

CRITICAL - Numeric requests:
If the user asks for "5 cards", "recommend 10", etc., set "limit" in your JSON to that number. Omit limit or use 200 if not specified.

CRITICAL - Full commander deck (100 cards, singleton):
When the user asks to "build a deck", "full commander deck", "complete deck", or similar, return limit 99 (the 99 non-commander cards). ALWAYS use a BROAD query: id:XXX is:commander order:edhrec (replace XXX with the commander's color letters: w,u,b,r,g). Exclude the commander with -!"Commander Name". Example for Maralen (BUG): id:ubg is:commander -!"Maralen, Fae Ascendant" order:edhrec. NEVER use narrow queries like t:land or o:ramp for full deck requests—those return too few cards.

RESPONSE TYPES:
1. **Rules / game-play questions** (e.g. "if my opponent plays X can I...", "how does X interact with Y", "can I tap in response"):
   Return skipSearch: true, scryfallQuery: "", and a full markdown message explaining the answer with headers, bullet points, and clear structure. Use the comprehensive rules context when relevant.

2. **Deck/card suggestions** (e.g. "creatures for Maralen", "Standard deck with X", "suggest cards for..."):
   Return a rich markdown message with tables, categories, and explanations. Use headers (##), tables (| Card | Mana | Role |), and bullet lists. Put card names in **bold** in tables. In your opening paragraph or strategy description, mention key recommended cards by name (e.g. "built around Zoraline, Cosmos Caller and Marauding Blight-Priest")—this helps surface them first in the card list. Also include scryfallQuery for the card search. Example table format:
   | **Card Name** | Mana | Role |
   |---|---|---|
   | **Bitterbloom Bearer** | {B}{B} | Creates Faerie tokens |

3. **Simple card search** (e.g. "ramp in green", "cheap removal"):
   Return scryfallQuery and a brief message.

CRITICAL - Multi-facet strategies:
When the user's request involves multiple distinct mechanics or strategy facets (e.g. "mobilize and ETB effects"), return a scryfallQueries ARRAY with one query per facet. Each entry has a "query" (Scryfall syntax) and a short "label" describing that facet. This ensures cards for every part of the strategy are found.
Example: "mobilize and ETB triggers in Standard" →
  scryfallQueries: [
    {"query": "kw:mobilize f:standard", "label": "Mobilize creatures"},
    {"query": "(o:\"whenever a creature enters\" OR o:\"whenever another creature enters\") f:standard", "label": "ETB payoff"}
  ]
For simple single-facet searches, you may use a single scryfallQuery string OR a one-element scryfallQueries array—either is fine.

Respond with JSON only:
{"scryfallQueries":[{"query":"...","label":"..."}],"scryfallQuery":"primary query or empty for rules questions","message":"Full markdown for advice/rules, or brief summary for simple search","limit":200,"colorIdentity":"ubg","skipSearch":false}

Set skipSearch: true only for rules/game-play questions. For deck requests, include colorIdentity. Always include scryfallQuery (the primary/first query) for backward compatibility.`

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  })

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body,
    })

    if (res.status === 429 && attempt < 2) {
      const waitMs = (attempt + 1) * 8000
      console.error(`[Gemini] 429 rate limit, retrying in ${waitMs / 1000}s...`)
      await sleep(waitMs)
      continue
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} ${err}`)
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty Gemini response')
    return text
  }

  throw new Error('Gemini API: rate limit exceeded after retries')
}

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  return content
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing message' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const apiKey = geminiKey || openaiKey
  const provider = geminiKey ? 'Gemini' : 'OpenAI'

  if (!apiKey) {
    res.status(503).json({
      error: 'LLM not configured',
      fallback: true,
      hint: 'Set GEMINI_API_KEY or OPENAI_API_KEY in .env',
    })
    return
  }

  try {
    const [mcpContext, mentionedCards] = await Promise.all([
      loadMCPContext(),
      (async () => {
        const names = extractCardNamesFromPrompt(message)
        if (names.length === 0) return []
        console.error(`[Chat] Looking up mentioned cards: ${names.join(', ')}`)
        return lookupCardsOnScryfall(names)
      })(),
    ])
    const cardContext = formatCardContext(mentionedCards)
    const fullSystem = `${SYSTEM_PROMPT}\n\n## Deck-building context (use when relevant)\n${mcpContext}${cardContext}`

    const content =
      provider === 'Gemini'
        ? await callGemini(apiKey, fullSystem, message)
        : await callOpenAI(apiKey, fullSystem, message)

    const parsed = JSON.parse(content) as {
      scryfallQuery?: string
      scryfallQueries?: Array<{ query: string; label?: string }>
      message?: string
      limit?: number
      colorIdentity?: string
      skipSearch?: boolean
    }
    const scryfallQuery = typeof parsed.scryfallQuery === 'string' ? parsed.scryfallQuery.trim() : ''
    const replyMessage = typeof parsed.message === 'string' ? parsed.message.trim() : 'Here are some cards that might fit.'
    const limit = typeof parsed.limit === 'number' && parsed.limit >= 1 && parsed.limit <= 200 ? parsed.limit : 200
    const skipSearch = parsed.skipSearch === true || (scryfallQuery === '' && replyMessage.length > 200)

    // Normalize multi-query array: use scryfallQueries if provided, else wrap scryfallQuery
    let scryfallQueries: Array<{ query: string; label: string }> = []
    if (Array.isArray(parsed.scryfallQueries) && parsed.scryfallQueries.length > 0) {
      scryfallQueries = parsed.scryfallQueries
        .filter((q) => typeof q.query === 'string' && q.query.trim())
        .map((q) => ({ query: q.query.trim(), label: typeof q.label === 'string' ? q.label : '' }))
    }
    if (scryfallQueries.length === 0 && scryfallQuery) {
      scryfallQueries = [{ query: scryfallQuery, label: '' }]
    }

    // Fallback for deck requests: when primary returns few cards, use broad query by color identity
    let fallbackQuery: string | undefined
    const colorId =
      typeof parsed.colorIdentity === 'string'
        ? parsed.colorIdentity.toLowerCase().replace(/[^wubrg]/g, '')
        : scryfallQuery.match(/\bid:([wubrg]+)\b/i)?.[1]?.toLowerCase()
    if (!skipSearch && limit >= 20 && colorId) {
      fallbackQuery = `id:${colorId} is:commander order:edhrec`
    }

    const primaryQuery = scryfallQueries[0]?.query || scryfallQuery
    console.error(`[LLM] skipSearch=${skipSearch} queries=${scryfallQueries.length} primary="${primaryQuery.slice(0, 80)}..." limit=${limit}`)

    if (skipSearch) {
      res.json({
        scryfallQuery: '',
        message: replyMessage,
        limit,
        skipSearch: true,
      })
      return
    }

    // Run Scryfall + reasons pipeline so cards and reasons arrive together
    let appCards: AppCard[] = []
    let totalCards = 0

    try {
      if (scryfallQueries.length > 1) {
        const perFacetLimit = Math.max(75, Math.ceil(limit / scryfallQueries.length))
        const results = await Promise.all(
          scryfallQueries.map((q) => fetchScryfallSearch(q.query, perFacetLimit))
        )
        const seen = new Set<string>()
        for (const r of results) {
          for (const c of r.cards) {
            if (!seen.has(c.id)) {
              seen.add(c.id)
              appCards.push(c)
            }
          }
        }
        totalCards = appCards.length
      } else {
        const result = await fetchScryfallSearch(primaryQuery || message, limit)
        appCards = result.cards
        totalCards = result.totalCards ?? appCards.length
        if (appCards.length < 24 && fallbackQuery) {
          const fallback = await fetchScryfallSearch(fallbackQuery, limit)
          if (fallback.cards.length > appCards.length) {
            appCards = fallback.cards
            totalCards = fallback.totalCards ?? appCards.length
          }
        }
      }

      // Exclude mentioned cards (e.g. "cheaper than X" — don't show X in results)
      const mentionedNames = extractCardNamesFromPrompt(message)
      if (mentionedNames.length > 0) {
        const mentionedCards = await lookupCardsOnScryfall(mentionedNames)
        const mentionedSet = new Set(mentionedCards.map((c) => c.name.toLowerCase()))
        if (mentionedSet.size > 0) {
          appCards = appCards.filter((c) => !mentionedSet.has(c.name.toLowerCase()))
          totalCards = appCards.length
        }
      }

      // Fetch reasons (same LLM call as before)
      const reasonMap = await fetchReasonsForCards(apiKey, provider, message, appCards, replyMessage)
      appCards = appCards.map((c) => {
        const reason =
          reasonMap.get(c.name.toLowerCase()) ??
          reasonMap.get(c.name.split(' // ')[0].trim().toLowerCase())
        return reason ? { ...c, reason } : c
      })

      appCards = applyRecommendedRanks(appCards, replyMessage)
      appCards = sortCardsByRelevance(appCards)

      console.error(`[Chat] Returning ${appCards.length} cards with reasons`)
      res.json({
        scryfallQuery: primaryQuery || message,
        ...(scryfallQueries.length > 1 && { scryfallQueries }),
        message: replyMessage,
        limit,
        skipSearch: false,
        cards: appCards,
        totalCards,
        ...(fallbackQuery && { fallbackQuery }),
      })
    } catch (err) {
      console.error('Scryfall/reasons pipeline error:', err)
      res.json({
        scryfallQuery: primaryQuery || message,
        ...(scryfallQueries.length > 1 && { scryfallQueries }),
        message: replyMessage,
        limit,
        skipSearch: false,
        ...(fallbackQuery && { fallbackQuery }),
      })
    }
  } catch (err) {
    console.error(`Chat API error (${provider}):`, err)
    res.status(502).json({ error: 'LLM request failed', fallback: true })
  }
})

const REASONS_SYSTEM = `You are a Magic: The Gathering deck-building assistant. Given the user's prompt and search context, explain why each card fits the request. Use CATEGORY-style explanations (e.g. "Card that gains life", "Life gain payoff", "Causes opponents to lose life")—NOT summaries of the oracle text. Match the language from the search context when possible.

Respond with JSON only:
{"reasons":[{"name":"Exact card name as given","reason":"Category-style reason (e.g. gains life, life gain payoff)"}]}

Match card names exactly. Return one reason per card. Max 12 words per reason.`

async function fetchReasonsForCards(
  apiKey: string,
  provider: 'Gemini' | 'OpenAI',
  prompt: string,
  cards: AppCard[],
  searchContext?: string
): Promise<Map<string, string>> {
  const cardList = cards.slice(0, 60).filter((c) => c.name.trim())
  if (cardList.length === 0) return new Map()
  const contextPart = searchContext?.trim()
    ? `\nSearch context (use this language for categories): "${searchContext}"`
    : ''
  const userMessage = `User asked: "${prompt}"${contextPart}

Cards (return reasons in this exact order, use exact names from the list):
${cardList.map((c, i) => `${i + 1}. ${c.name}${c.oracleText ? ` — ${c.oracleText.slice(0, 200)}` : ''}`).join('\n')}

For each card, give a SHORT category-style reason (e.g. "Gains life", "Life gain payoff", "Causes opponents to lose life"). Use the search context's phrasing. Do NOT quote or summarize the oracle text. Return JSON: {"reasons":[{"name":"exact name from list","reason":"category reason"}]}`
  try {
    const content =
      provider === 'Gemini'
        ? await callGemini(apiKey, REASONS_SYSTEM, userMessage)
        : await callOpenAI(apiKey, REASONS_SYSTEM, userMessage)
    const parsed = JSON.parse(content) as { reasons?: Array<{ name: string; reason: string }> }
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []
    const map = new Map<string, string>()
    for (const r of reasons) {
      const name = r.name?.trim()
      if (name && r.reason?.trim()) map.set(name.toLowerCase(), r.reason.trim())
    }
    return map
  } catch {
    return new Map()
  }
}

app.post('/api/cards/reasons', async (req, res) => {
  const { prompt, cards, searchContext } = req.body
  if (!prompt || typeof prompt !== 'string' || !Array.isArray(cards) || cards.length === 0) {
    res.status(400).json({ error: 'Missing prompt or cards array' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const apiKey = geminiKey || openaiKey
  const provider = geminiKey ? 'Gemini' : 'OpenAI'

  if (!apiKey) {
    res.status(503).json({ error: 'LLM not configured' })
    return
  }

  const cardList = cards
    .slice(0, 60)
    .map((c: { name?: string; oracleText?: string }) => ({
      name: String(c.name ?? ''),
      oracleText: String(c.oracleText ?? '').slice(0, 200),
    }))
    .filter((c: { name: string }) => c.name.trim())

  if (cardList.length === 0) {
    res.json({ reasons: [] })
    return
  }

  const contextPart = searchContext && typeof searchContext === 'string' && searchContext.trim()
    ? `\nSearch context (use this language for categories): "${searchContext}"`
    : ''

  const userMessage = `User asked: "${prompt}"${contextPart}

Cards (return reasons in this exact order, use exact names from the list):
${cardList.map((c: { name: string; oracleText: string }, i: number) => `${i + 1}. ${c.name}${c.oracleText ? ` — ${c.oracleText}` : ''}`).join('\n')}

For each card, give a SHORT category-style reason (e.g. "Gains life", "Life gain payoff", "Causes opponents to lose life"). Use the search context's phrasing. Do NOT quote or summarize the oracle text. Return JSON: {"reasons":[{"name":"exact name from list","reason":"category reason"}]}`

  try {
    const content =
      provider === 'Gemini'
        ? await callGemini(apiKey, REASONS_SYSTEM, userMessage)
        : await callOpenAI(apiKey, REASONS_SYSTEM, userMessage)

    const parsed = JSON.parse(content) as { reasons?: Array<{ name: string; reason: string }> }
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []
    console.error(`[LLM] card reasons: ${reasons.length} for "${prompt.slice(0, 40)}..."`)
    res.json({ reasons })
  } catch (err) {
    console.error('Card reasons API error:', err)
    res.status(502).json({ error: 'LLM request failed', reasons: [] })
  }
})

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.error(`Deck Tutor API running on http://localhost:${PORT}`)
  if (process.env.GEMINI_API_KEY) {
    console.error('  Using Gemini for AI-powered search')
  } else if (process.env.OPENAI_API_KEY) {
    console.error('  Using OpenAI for AI-powered search')
  } else {
    console.error('  Set GEMINI_API_KEY or OPENAI_API_KEY in .env for AI-powered search')
  }
})
