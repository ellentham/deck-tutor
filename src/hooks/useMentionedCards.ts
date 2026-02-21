import { useState, useEffect, useCallback } from 'react'
import { extractMentionedCardNames } from '../lib/mentionedCards'
import type { Card } from '../components/CardGrid'

const CACHE = new Map<string, Card[]>()

async function fetchCard(name: string): Promise<Card | null> {
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
        oracleText: data.oracleText,
        scryfallUri: data.scryfallUri,
      }
    }
    return null
  } catch {
    return null
  }
}

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
    const results = await Promise.all(names.map(fetchCard))
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
