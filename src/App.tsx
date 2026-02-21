import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { ChatBox } from './components/ChatBox'
import { ChatPanel, type Message } from './components/ChatPanel'
import { CardGrid } from './components/CardGrid'
import { useScryfallSearch } from './hooks/useScryfallSearch'
import { chatWithLLM } from './lib/llmChat'
import { parseSearchPrompt } from './lib/promptParser'
import './App.css'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const { cards, isLoading, error, search, searchWithQuery } = useScryfallSearch()

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.ok)
      .then(setBackendOk)
      .catch(() => setBackendOk(false))
  }, [])

  const hasPrompt = messages.length > 0

  const handleSend = async (content: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((prev) => [...prev, userMsg])

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: 'Searching...' },
    ])

    const llmResponse = await chatWithLLM(content)

    if (llmResponse) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: llmResponse!.message } : m
        )
      )
      searchWithQuery(llmResponse.scryfallQuery, llmResponse.limit ?? 20)
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
        search(content)
      } else {
        searchWithQuery(parsed.searchQuery)
      }
    }
  }

  return (
    <div className={`app ${hasPrompt ? 'app--active' : 'app--initial'}`}>
      <div className="app-content">
        {hasPrompt ? (
          <>
            {backendOk === false && (
              <div className="app__backend-warning app__backend-warning--inline">
                Backend not running — showing limited results. Run <code>npm run dev</code> for full AI + Scryfall.
              </div>
            )}
            <div className="cards-area">
              <CardGrid
                cards={cards}
                isLoading={isLoading}
                error={error}
              />
            </div>
            <div className="chat-area">
              <ChatPanel
                messages={messages}
                onSend={handleSend}
                isCollapsed={isChatCollapsed}
                onToggleCollapse={() => setIsChatCollapsed((c) => !c)}
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
              Deck Tutor
            </motion.h1>
            <motion.p
              className="app__subtitle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Build Magic decks with AI guidance. Ask about cards, formats, or strategies.
            </motion.p>
            <ChatBox onSubmit={handleSend} />
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default App
