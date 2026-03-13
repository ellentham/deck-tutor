import { useState, useEffect, useCallback } from 'react'
import { extractMentionedCardNames } from '../lib/mentionedCards'
import { fetchCardByName } from '../lib/scryfallApi'
import type { Card } from '../types/card'

const CACHE = new Map<string, Card[]>()

export function useMentionedCards(prompt: string | null): Card[] {
  const [cards, setCards] = useState<Card[]>([])

  const load = useCallback(async (text: string) => {
    const names = extractMentionedCardNames(text)
    if (names.length === 0) {
      setCards([])
      return
    }
    const cacheKey = names.map((n) => n.toLowerCase()).sort().join('|')
    const cached = CACHE.get(cacheKey)
    if (cached) {
      setCards(cached)
      return
    }
    const results = await Promise.all(names.map(fetchCardByName))
    const found = results.filter((c): c is Card => c !== null)
    // Dedupe by card id (same card can appear if extraction had duplicates)
    const deduped = found.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    CACHE.set(cacheKey, deduped)
    setCards(deduped)
  }, [])

  useEffect(() => {
    if (!prompt?.trim()) {
      setCards([])
      return
    }
    load(prompt)
  }, [prompt, load])

  return cards
}
