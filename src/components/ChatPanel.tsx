import { useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatBox } from './ChatBox'
import { useMentionedCards } from '../hooks/useMentionedCards'
import type { Card } from '../types/card'
import './ChatPanel.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const ChatMessage = memo(function ChatMessage({ msg, onCardClick }: { msg: Message; onCardClick?: (card: Card) => void }) {
  const userMentionedCards = useMentionedCards(
    msg.role === 'user' ? msg.content : null
  )
  const cardsToShow = msg.role === 'user' ? userMentionedCards : []

  return (
    <motion.div
      className={`chat-panel__message chat-panel__message--${msg.role}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {cardsToShow.length > 0 && (
        <div className="chat-panel__mentioned-cards">
          {cardsToShow.map((card) => (
            <button
              key={card.id}
              type="button"
              className="chat-panel__mentioned-card"
              title={card.name}
              aria-label={`View ${card.name}`}
              onClick={() => onCardClick?.(card)}
            >
              <img src={card.imageUrl} alt={card.name} />
            </button>
          ))}
        </div>
      )}
      {msg.role === 'assistant' ? (
        <div className="chat-panel__markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
      ) : (
        <p>{msg.content}</p>
      )}
    </motion.div>
  )
})

interface ChatPanelProps {
  messages: Message[]
  onSend: (message: string) => void
  onCardClick?: (card: Card) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobile?: boolean
}

export function ChatPanel({ messages, onSend, onCardClick, isCollapsed, onToggleCollapse, isMobile = false }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const collapsedHeight = 56
  const expandedHeight = isMobile ? '60vh' : '100%'

  return (
    <motion.div
      className={`chat-panel ${isCollapsed ? 'chat-panel--collapsed' : ''} ${isMobile ? 'chat-panel--mobile' : ''}`}
      initial={false}
      animate={
        isMobile
          ? {
              width: '100%',
              height: isCollapsed ? collapsedHeight : expandedHeight,
            }
          : { width: isCollapsed ? 56 : 420 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <button
        type="button"
        className="chat-panel__toggle"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isMobile
              ? isCollapsed
                ? 'rotate(-90deg)'
                : 'rotate(90deg)'
              : isCollapsed
                ? 'none'
                : 'rotate(180deg)',
          }}
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.div
            key="collapsed"
            className="chat-panel__collapsed-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>Chat</span>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            className="chat-panel__content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="chat-panel__header">
              <h2 className="chat-panel__title">Deck tutor</h2>
            </div>
            <div className="chat-panel__messages">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} msg={msg} onCardClick={onCardClick} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-panel__input-wrap">
              <ChatBox onSubmit={onSend} placeholder="Follow up..." />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
