import { useState, useCallback } from 'react'
import {
  searchFromParsedPrompt,
  searchByQuery,
  toAppCard,
  getSampleCardsForDisplay,
} from '../lib/scryfallApi'
import { parseSearchPrompt } from '../lib/promptParser'
import type { Card } from '../components/CardGrid'

export function useScryfallSearch() {
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setCards([])
      return
    }
    setIsLoading(true)
    setError(null)
    setCards(getSampleCardsForDisplay().map(toAppCard))

    try {
      const parsed = parseSearchPrompt(prompt)
      const scryfallCards = await searchFromParsedPrompt(parsed, {
        preferLocal: true,
        limit: 20,
      })
      setCards(scryfallCards.map(toAppCard))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setCards(getSampleCardsForDisplay().map(toAppCard))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const searchWithQuery = useCallback(async (query: string, limit = 20) => {
    if (!query.trim()) {
      setCards([])
      return
    }
    setIsLoading(true)
    setError(null)
    setCards(getSampleCardsForDisplay().map(toAppCard))

    try {
      const scryfallCards = await searchByQuery(query, { limit })
      setCards(scryfallCards.map(toAppCard))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setCards(getSampleCardsForDisplay().map(toAppCard))
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { cards, isLoading, error, search, searchWithQuery }
}
