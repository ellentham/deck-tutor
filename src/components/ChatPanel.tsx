import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChatBox } from './ChatBox'
import './ChatPanel.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  messages: Message[]
  onSend: (message: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ChatPanel({ messages, onSend, isCollapsed, onToggleCollapse }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <motion.div
      className={`chat-panel ${isCollapsed ? 'chat-panel--collapsed' : ''}`}
      initial={false}
      animate={{ width: isCollapsed ? 56 : 420 }}
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
          style={{ transform: isCollapsed ? 'none' : 'rotate(180deg)' }}
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
              <h2 className="chat-panel__title">Deck Tutor</h2>
            </div>
            <div className="chat-panel__messages">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`chat-panel__message chat-panel__message--${msg.role}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p>{msg.content}</p>
                </motion.div>
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
