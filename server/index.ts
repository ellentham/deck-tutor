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
const RESOURCES_DIR = join(__dirname, '..', 'deck-tutor-mcp', 'resources')

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
  return parts.join('\n\n')
}

/** Health check - frontend can verify backend is running */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llm: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) })
})

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

const SYSTEM_PROMPT = `You are a Magic: The Gathering deck-building assistant. Convert the user's natural language request into a Scryfall search query.

Scryfall syntax reference:
- o: or oracle: - oracle text (e.g. o:draw, o:ramp)
- t: or type: - card type AND subtypes (e.g. t:creature, t:elf, t:faerie)
- c: or id: - color/identity (w,u,b,r,g; id:ubg = black/green/blue)
- kw: - keyword (e.g. kw:flying)
- pow: / tou: - power/toughness (e.g. pow:1, tou>=4)
- is:commander - commander-legal cards
- f:format - format (commander, modern, etc.)
- order:edhrec - sort by EDHREC popularity (use for Commander)
- Use OR for alternatives: (t:elf OR t:faerie)
- Use quotes for phrases: o:"enters the battlefield"

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
If the user asks for "5 cards", "recommend 10", etc., set "limit" in your JSON to that number. Omit limit or use 20 if not specified.

Respond with JSON only, no markdown:
{"scryfallQuery":"your Scryfall query here","message":"Brief natural language summary for the user","limit":20}

The scryfallQuery must be valid Scryfall syntax. The message should be 1-2 sentences.`

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    }
  )
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
    const mcpContext = await loadMCPContext()
    const fullSystem = `${SYSTEM_PROMPT}\n\n## Deck-building context (use when relevant)\n${mcpContext}`

    const content =
      provider === 'Gemini'
        ? await callGemini(apiKey, fullSystem, message)
        : await callOpenAI(apiKey, fullSystem, message)

    const parsed = JSON.parse(content) as { scryfallQuery?: string; message?: string; limit?: number }
    const scryfallQuery = typeof parsed.scryfallQuery === 'string' ? parsed.scryfallQuery.trim() : ''
    const replyMessage = typeof parsed.message === 'string' ? parsed.message.trim() : 'Here are some cards that might fit.'
    const limit = typeof parsed.limit === 'number' && parsed.limit >= 1 && parsed.limit <= 50 ? parsed.limit : 20

    console.error(`[LLM] query="${scryfallQuery.slice(0, 80)}..." limit=${limit}`)
    res.json({
      scryfallQuery: scryfallQuery || message,
      message: replyMessage,
      limit,
    })
  } catch (err) {
    console.error(`Chat API error (${provider}):`, err)
    res.status(502).json({ error: 'LLM request failed', fallback: true })
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
