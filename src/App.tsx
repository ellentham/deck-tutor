import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { ChatBox } from './components/ChatBox'
import { ChatPanel, type Message } from './components/ChatPanel'
import { CardGrid, type Card } from './components/CardGrid'
import { CardList } from './components/CardList'
import { CardDetailModal } from './components/CardDetailModal'
import { useScryfallSearch } from './hooks/useScryfallSearch'
import { useMediaQuery } from './hooks/useMediaQuery'
import { chatWithLLM } from './lib/llmChat'
import { parseSearchPrompt } from './lib/promptParser'
import './App.css'

type CardViewMode = 'grid' | 'list'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('grid')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [globalCardCount, setGlobalCardCount] = useState<number | null>(null)
  const [isResponding, setIsResponding] = useState(false)
  const { cards, totalCards, isLoading, error, search, searchWithQuery, clearCards } = useScryfallSearch()
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

  const handleSend = async (content: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setIsResponding(true)
    clearCards()

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
        await searchWithQuery(
          llmResponse.scryfallQuery,
          llmResponse.limit ?? 200,
          llmResponse.fallbackQuery,
          content,
          llmResponse.message
        )
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
                    {(totalCards ?? cards.length).toLocaleString()} card{(totalCards ?? cards.length) !== 1 ? 's' : ''} found
                  </span>
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
              <div ref={cardsAreaRef} className="cards-area__scroll">
                {cardViewMode === 'list' ? (
                  <CardList
                    cards={cards}
                    isLoading={isLoading || isResponding}
                    error={error}
                    scrollContainerRef={cardsAreaRef}
                    onCardClick={setSelectedCard}
                  />
                ) : (
                  <CardGrid
                    cards={cards}
                    isLoading={isLoading || isResponding}
                    error={error}
                    scrollContainerRef={cardsAreaRef}
                    onCardClick={setSelectedCard}
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
              cards, rules, formats, or strategies.
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
