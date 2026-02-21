/**
 * LLM-powered chat API client.
 * Converts natural language to Scryfall queries using MCP resources as context.
 * Falls back to rule-based parsing when API is unavailable.
 */

export interface ChatResponse {
  scryfallQuery: string
  message: string
  limit?: number
}

export async function chatWithLLM(userMessage: string): Promise<ChatResponse | null> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    })

    if (res.ok) {
      const data = (await res.json()) as ChatResponse & { limit?: number }
      return {
        scryfallQuery: data.scryfallQuery?.trim() || userMessage,
        message: data.message?.trim() || 'Here are some cards that might fit.',
        limit: data.limit,
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
