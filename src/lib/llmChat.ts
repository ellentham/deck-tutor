/**
 * LLM-powered chat API client.
 * Converts natural language to Scryfall queries using MCP resources as context.
 * Falls back to rule-based parsing when API is unavailable.
 */

export interface ChatResponse {
  scryfallQuery: string
  message: string
  limit?: number
  /** When true, skip card search (e.g. rules questions) */
  skipSearch?: boolean
  /** Broad fallback query when primary returns few cards (deck building) */
  fallbackQuery?: string
}

export async function chatWithLLM(userMessage: string): Promise<ChatResponse | null> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })

    if (res.ok) {
      const data = (await res.json()) as ChatResponse & { limit?: number; fallbackQuery?: string; skipSearch?: boolean }
      return {
        scryfallQuery: data.scryfallQuery?.trim() || userMessage,
        message: data.message?.trim() || 'Here are some cards that might fit.',
        limit: data.limit,
        skipSearch: data.skipSearch,
        fallbackQuery: data.fallbackQuery?.trim(),
      }
    }

    // 503 = no API key, 502/500 = LLM error - caller should use fallback
    const err = await res.json().catch(() => ({}))
    if ((err as { fallback?: boolean }).fallback) {
      return null
    }
    return null
  } catch {
    // Network error, server not running, etc.
    return null
  }
}

export interface CardReason {
  name: string
  reason: string
}

export async function fetchCardReasons(
  prompt: string,
  cards: Array<{ name: string; oracleText?: string }>,
  searchContext?: string
): Promise<CardReason[]> {
  if (!prompt.trim() || cards.length === 0) return []
  try {
    const res = await fetch('/api/cards/reasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, cards, searchContext: searchContext?.trim() || undefined }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { reasons?: CardReason[] }
    return Array.isArray(data.reasons) ? data.reasons : []
  } catch {
    return []
  }
}
