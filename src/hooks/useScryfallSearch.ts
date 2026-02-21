import { useState, useCallback } from 'react'
import {
  searchFromParsedPrompt,
  searchByQuery,
  toAppCard,
  getSampleCardsForDisplay,
} from '../lib/scryfallApi'
import { parseSearchPrompt } from '../lib/promptParser'
import { fetchCardReasons } from '../lib/llmChat'
import { extractMentionedCardNames } from '../lib/mentionedCards'
import { sortByRelevance } from '../lib/cardSort'
import type { Card } from '../components/CardGrid'

async function fetchCardByName(name: string): Promise<Card | null> {
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

const REASONS_DELAY_MS = 6000

export function useScryfallSearch() {
  const [cards, setCards] = useState<Card[]>([])
  const [totalCards, setTotalCards] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setCards([])
      setTotalCards(null)
      return
    }
    setIsLoading(true)
    setError(null)
    setCards([])
    setTotalCards(null)

    try {
      const parsed = parseSearchPrompt(prompt)
      const { cards: scryfallCards, totalCards: tc } = await searchFromParsedPrompt(parsed, {
        preferLocal: true,
        limit: 200,
      })
      setTotalCards(tc ?? scryfallCards.length)
      let appCards = scryfallCards.map(toAppCard)
      setCards(sortByRelevance(appCards))

      await new Promise((r) => setTimeout(r, REASONS_DELAY_MS))
      const reasons = await fetchCardReasons(prompt, appCards)
      if (reasons.length > 0) {
        const reasonMap = new Map(reasons.map((r) => [r.name.trim().toLowerCase(), r.reason]))
        const getReason = (card: Card, index: number) => {
          const byName =
            reasonMap.get(card.name.trim().toLowerCase()) ??
            reasonMap.get(card.name.split(' // ')[0].trim().toLowerCase())
          if (byName) return byName
          if (reasons[index]?.reason) return reasons[index].reason
          return undefined
        }
        appCards = appCards.map((c, i) => ({ ...c, reason: getReason(c, i) }))
        setCards(sortByRelevance(appCards))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      const sample = getSampleCardsForDisplay().map(toAppCard)
      setCards(sample)
      setTotalCards(sample.length)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const searchWithQuery = useCallback(
    async (
      query: string,
      limit = 200,
      fallbackQuery?: string,
      prompt?: string,
      searchContext?: string
    ) => {
      if (!query.trim()) {
        setCards([])
        return
      }
      setIsLoading(true)
      setError(null)
      setCards([])
      setTotalCards(null)

      try {
        let result = await searchByQuery(query, { limit })
        let scryfallCards = result.cards
        // If primary returns few cards and we have a fallback, try the broader query
        if (scryfallCards.length < 24 && fallbackQuery?.trim()) {
          const fallbackResult = await searchByQuery(fallbackQuery.trim(), { limit })
          if (fallbackResult.cards.length > scryfallCards.length) {
            scryfallCards = fallbackResult.cards
            result = fallbackResult
          }
        }
        setTotalCards(result.totalCards ?? scryfallCards.length)
        let appCards = scryfallCards.map(toAppCard)

        // Exclude cards the user mentioned (e.g. "cheaper than Demonic Tutor") so they don't repeat in results
        if (prompt?.trim()) {
          const mentionedNames = extractMentionedCardNames(prompt)
          if (mentionedNames.length > 0) {
            const mentioned = await Promise.all(mentionedNames.map(fetchCardByName))
            const mentionedIds = new Set(
              mentioned.filter((c): c is Card => c !== null).map((c) => c.id?.toLowerCase())
            )
            if (mentionedIds.size > 0) {
              appCards = appCards.filter((c) => !mentionedIds.has(c.id?.toLowerCase() ?? ''))
              setTotalCards(appCards.length)
            }
          }
        }
        setCards(sortByRelevance(appCards))

        if (prompt?.trim()) {
          await new Promise((r) => setTimeout(r, REASONS_DELAY_MS))
          const reasons = await fetchCardReasons(prompt, appCards, searchContext)
          if (reasons.length > 0) {
            const reasonMap = new Map(reasons.map((r) => [r.name.trim().toLowerCase(), r.reason]))
            const getReason = (card: Card, index: number) => {
              const byName =
                reasonMap.get(card.name.trim().toLowerCase()) ??
                reasonMap.get(card.name.split(' // ')[0].trim().toLowerCase())
              if (byName) return byName
              if (reasons[index]?.reason) return reasons[index].reason
              return undefined
            }
            appCards = appCards.map((c, i) => ({ ...c, reason: getReason(c, i) }))
            setCards(sortByRelevance(appCards))
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        const sample = getSampleCardsForDisplay().map(toAppCard)
        setCards(sample)
        setTotalCards(sample.length)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const clearCards = useCallback(() => {
    setCards([])
    setTotalCards(null)
    setError(null)
  }, [])

  return { cards, totalCards, isLoading, error, search, searchWithQuery, clearCards }
}
