import { useState, useCallback } from 'react'
import {
  searchFromParsedPrompt,
  searchByQuery,
  toAppCard,
  getSampleCardsForDisplay,
  fetchCardByName,
} from '../lib/scryfallApi'
import type { ScryfallCard } from '../lib/scryfallTypes'
import { parseSearchPrompt } from '../lib/promptParser'
import { fetchCardReasons } from '../lib/llmChat'
import type { QueryFacet } from '../lib/llmChat'
import { extractMentionedCardNames } from '../lib/mentionedCards'
import { sortByRelevance, applyRecommendedRanks } from '../lib/cardSort'
import type { Card } from '../types/card'

const REASONS_DELAY_MS = 300

export function useScryfallSearch() {
  const [cards, setCards] = useState<Card[]>([])
  const [totalCards, setTotalCards] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingReasons, setIsLoadingReasons] = useState(false)
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

      setIsLoadingReasons(true)
      await new Promise((r) => setTimeout(r, REASONS_DELAY_MS))
      const reasons = await fetchCardReasons(prompt, appCards)
      setIsLoadingReasons(false)
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
      setIsLoadingReasons(false)
    }
  }, [])

  const searchWithQuery = useCallback(
    async (
      query: string,
      limit = 200,
      fallbackQuery?: string,
      prompt?: string,
      searchContext?: string,
      queryFacets?: QueryFacet[]
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
        let scryfallCards: ScryfallCard[] = []
        let totalFromApi: number | undefined

        if (queryFacets && queryFacets.length > 1) {
          // Multi-facet: run all queries in parallel, merge and deduplicate
          const perFacetLimit = Math.max(75, Math.ceil(limit / queryFacets.length))
          const results = await Promise.all(
            queryFacets.map((f) =>
              searchByQuery(f.query, { limit: perFacetLimit }).catch(() => ({ cards: [], totalCards: 0 }))
            )
          )

          const seen = new Set<string>()
          for (const result of results) {
            for (const card of result.cards) {
              if (!seen.has(card.id)) {
                seen.add(card.id)
                scryfallCards.push(card)
              }
            }
          }
          totalFromApi = scryfallCards.length
        } else {
          // Single query (original path)
          const result = await searchByQuery(query, { limit })
          scryfallCards = result.cards
          totalFromApi = result.totalCards ?? scryfallCards.length

          if (scryfallCards.length < 24 && fallbackQuery?.trim()) {
            const fallbackResult = await searchByQuery(fallbackQuery.trim(), { limit })
            if (fallbackResult.cards.length > scryfallCards.length) {
              scryfallCards = fallbackResult.cards
              totalFromApi = fallbackResult.totalCards ?? scryfallCards.length
            }
          }
        }

        setTotalCards(totalFromApi)
        let appCards: Card[] = scryfallCards.map(toAppCard)

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

        if (searchContext?.trim()) {
          appCards = applyRecommendedRanks(appCards, searchContext)
        }
        setCards(sortByRelevance(appCards))

        if (prompt?.trim()) {
          setIsLoadingReasons(true)
          await new Promise((r) => setTimeout(r, REASONS_DELAY_MS))
          const reasons = await fetchCardReasons(prompt, appCards, searchContext)
          setIsLoadingReasons(false)
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
        setIsLoadingReasons(false)
      }
    },
    []
  )

  const clearCards = useCallback(() => {
    setCards([])
    setTotalCards(null)
    setError(null)
    setIsLoadingReasons(false)
  }, [])

  const setCardsFromResponse = useCallback((newCards: Card[], total?: number) => {
    setCards(newCards)
    setTotalCards(total ?? newCards.length)
    setError(null)
  }, [])

  return { cards, totalCards, isLoading, isLoadingReasons, error, search, searchWithQuery, clearCards, setCardsFromResponse }
}
