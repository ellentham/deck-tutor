import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'motion/react'
import { ChatBox } from './components/ChatBox'
import { ChatPanel, type Message } from './components/ChatPanel'
import type { Card } from './types/card'
import { CardGrid } from './components/CardGrid'
import { CardList } from './components/CardList'
import { CardDetailModal } from './components/CardDetailModal'
import { CardsFilterPopover } from './components/CardsFilterPopover'
import { CardsPagination } from './components/CardsPagination'
import { useScryfallSearch } from './hooks/useScryfallSearch'
import { useMediaQuery } from './hooks/useMediaQuery'
import { chatWithLLM } from './lib/llmChat'
import { parseSearchPrompt } from './lib/promptParser'
import {
  filterCardsByColors,
  filterCardsByReasons,
  sortCardsBy,
  type SortOption,
} from './lib/cardSort'
import './App.css'

type CardViewMode = 'grid' | 'list'
const DEFAULT_PAGE_SIZE = 24

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('grid')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [globalCardCount, setGlobalCardCount] = useState<number | null>(null)
  const [isResponding, setIsResponding] = useState(false)
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set())
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set())
  const [sortOption, setSortOption] = useState<SortOption>('default')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const { cards, isLoading, isLoadingReasons, error, search, searchWithQuery, clearCards, setCardsFromResponse } = useScryfallSearch()
  const cardsAreaRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 379px)')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.ok)
      .then(setBackendOk)
      .catch(() => setBackendOk(false))
  }, [])

  useEffect(() => {
    fetch('/api/scryfall/count')
      .then((r) => r.json())
      .then((data: { total_cards?: number | null }) =>
        setGlobalCardCount(typeof data.total_cards === 'number' ? data.total_cards : null)
      )
      .catch(() => setGlobalCardCount(null))
  }, [])

  const hasPrompt = messages.length > 0

  const { paginatedCards, filteredTotal } = useMemo(() => {
    let list = filterCardsByColors(cards, selectedColors)
    list = filterCardsByReasons(list, selectedReasons)
    list = sortCardsBy(list, sortOption)
    const total = list.length
    const start = (page - 1) * pageSize
    const paginated = list.slice(start, start + pageSize)
    return { paginatedCards: paginated, filteredTotal: total }
  }, [cards, selectedColors, selectedReasons, sortOption, page, pageSize])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredTotal / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [filteredTotal, pageSize, page])

  const handleSend = async (content: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setIsResponding(true)
    clearCards()
    setSelectedColors(new Set())
    setSelectedReasons(new Set())
    setSortOption('default')
    setPage(1)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: 'Searching...' },
    ])

    try {
      const llmResponse = await chatWithLLM(content)

      if (llmResponse) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: llmResponse!.message } : m
          )
        )
        if (llmResponse.skipSearch) {
          // Rules question — no cards
        } else if (llmResponse.cards && llmResponse.cards.length > 0) {
          // Server returned cards with reasons — use directly
          setCardsFromResponse(llmResponse.cards, llmResponse.totalCards)
        } else if (llmResponse.scryfallQuery) {
          // Fallback: server didn't return cards (e.g. pipeline error) — run client-side search
          await searchWithQuery(
            llmResponse.scryfallQuery,
            llmResponse.limit ?? 200,
            llmResponse.fallbackQuery,
            content,
            llmResponse.message,
            llmResponse.scryfallQueries
          )
        }
      } else {
        const parsed = parseSearchPrompt(content)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Searching for cards matching "${content}"...` }
              : m
          )
        )
        if (parsed.useNamedLookup) {
          await search(content)
        } else {
          await searchWithQuery(parsed.searchQuery, 200, undefined, content)
        }
      }
    } finally {
      setIsResponding(false)
    }
  }

  return (
    <div className={`app ${hasPrompt ? 'app--active' : 'app--initial'} ${isMobile ? 'app--mobile' : ''}`}>
      <div className="app-content">
        {hasPrompt ? (
          <>
            {backendOk === false && (
              <div className="app__backend-warning app__backend-warning--inline">
                Backend not running — showing limited results. Run <code>npm run dev</code> for full AI + Scryfall.
              </div>
            )}
            <div className="cards-area">
              <div className="cards-area__header">
                {cards.length > 0 && (
                  <span className="cards-area__count">
                    {filteredTotal.toLocaleString()} card{filteredTotal !== 1 ? 's' : ''}
                    {filteredTotal !== cards.length && ` (of ${cards.length})`}
                  </span>
                )}
                <div className="cards-area__header-actions">
                  {cards.length > 0 && (
                    <CardsFilterPopover
                      cards={cards}
                      selectedColors={selectedColors}
                      selectedReasons={selectedReasons}
                      sortOption={sortOption}
                      isLoadingReasons={isLoadingReasons}
                      onColorsChange={(c) => {
                        setSelectedColors(c)
                        setPage(1)
                      }}
                      onReasonsChange={(r) => {
                        setSelectedReasons(r)
                        setPage(1)
                      }}
                      onSortChange={(o) => {
                        setSortOption(o)
                        setPage(1)
                      }}
                    />
                  )}
                  <div className="cards-area__view-toggle">
                    <button
                      type="button"
                      className={`cards-area__view-btn ${cardViewMode === 'list' ? 'cards-area__view-btn--active' : ''}`}
                      onClick={() => setCardViewMode('list')}
                      aria-pressed={cardViewMode === 'list'}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className={`cards-area__view-btn ${cardViewMode === 'grid' ? 'cards-area__view-btn--active' : ''}`}
                      onClick={() => setCardViewMode('grid')}
                      aria-pressed={cardViewMode === 'grid'}
                    >
                      Grid
                    </button>
                  </div>
                </div>
              </div>
              {cards.length > 0 && (
                <div className="cards-area__pagination">
                  <CardsPagination
                    totalItems={filteredTotal}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
              <div ref={cardsAreaRef} className="cards-area__scroll">
                {cardViewMode === 'list' ? (
                  <CardList
                    cards={paginatedCards}
                    isLoading={isLoading || isResponding}
                    error={error}
                    scrollContainerRef={cardsAreaRef}
                    onCardClick={setSelectedCard}
                    rankOffset={(page - 1) * pageSize}
                  />
                ) : (
                  <CardGrid
                    cards={paginatedCards}
                    isLoading={isLoading || isResponding}
                    error={error}
                    scrollContainerRef={cardsAreaRef}
                    onCardClick={setSelectedCard}
                    isLoadingReasons={isLoadingReasons}
                  />
                )}
              </div>
            </div>
            <div className={`chat-area ${isMobile ? 'chat-area--mobile' : ''}`}>
              <ChatPanel
                messages={messages}
                onSend={handleSend}
                onCardClick={setSelectedCard}
                isCollapsed={isChatCollapsed}
                onToggleCollapse={() => setIsChatCollapsed((c) => !c)}
                isMobile={isMobile}
              />
            </div>
          </>
        ) : (
          <motion.div
            className="app__welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {backendOk === false && (
              <div className="app__backend-warning">
                Backend not running — AI and Scryfall will use limited fallbacks. Run{' '}
                <code>npm run dev</code> to start both.
              </div>
            )}
            <motion.h1
              className="app__title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Deck tutor
            </motion.h1>
            <motion.p
              className="app__subtitle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Ask for advice about Magic's{' '}
              {globalCardCount != null ? globalCardCount.toLocaleString() : '30,000+'}{' '}
              cards.
            </motion.p>
            <ChatBox onSubmit={handleSend} />
            <p className="app__disclaimer">
              Deck Tutor is unofficial Fan Content permitted under the Fan Content Policy. Not
              approved/endorsed by Wizards. Portions of the materials used are property of Wizards
              of the Coast. ©Wizards of the Coast LLC.
            </p>
          </motion.div>
        )}
      </div>
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  )
}

export default App
