import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import './CardGrid.css'

export function SearchingMessage({ className = 'card-grid__empty-message' }: { className?: string }) {
  const [dots, setDots] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 400)
    return () => clearInterval(id)
  }, [])
  return (
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={className}>
      Searching{'.'.repeat(dots)}
    </motion.p>
  )
}

const INITIAL_BATCH = 24
const LOAD_MORE_BATCH = 24

export interface Card {
  id: string
  name: string
  typeLine: string
  manaCost: string
  imageUrl: string
  oracleText?: string
  scryfallUri?: string
  /** AI-generated reason why this card fits the user's prompt */
  reason?: string
}

interface CardGridProps {
  cards: Card[]
  isLoading?: boolean
  error?: string | null
  /** Scroll container for lazy-load observer (e.g. cards-area). Uses viewport if null. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onCardClick?: (card: Card) => void
}

export function CardGrid({ cards, isLoading, error, scrollContainerRef, onCardClick }: CardGridProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Reset when cards change (new search)
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH)
  }, [cards])

  // Lazy load more when sentinel scrolls into view (use scroll container as root)
  useEffect(() => {
    if (visibleCount >= cards.length) return
    const el = loadMoreRef.current
    const root = scrollContainerRef?.current ?? null
    if (!el || (scrollContainerRef && !root)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + LOAD_MORE_BATCH, cards.length))
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, cards.length, scrollContainerRef])
  if (error) {
    return (
      <div className="card-grid card-grid--empty">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-grid__empty-message card-grid__empty-message--error"
        >
          {error}
        </motion.p>
      </div>
    )
  }

  if (isLoading && cards.length === 0) {
    return (
      <div className="card-grid card-grid--empty">
        <SearchingMessage />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="card-grid card-grid--empty">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="card-grid__empty-message"
        >
          No cards found. Try: lightning bolt, counterspell, or red creature
        </motion.p>
      </div>
    )
  }

  const visibleCards = cards.slice(0, visibleCount)
  const hasMore = visibleCount < cards.length

  return (
    <div className="card-grid">
      {visibleCards.map((card, i) => (
        <motion.article
          key={card.id}
          className={`card-grid__card ${onCardClick ? 'card-grid__card--clickable' : ''}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.5) }}
          onClick={() => onCardClick?.(card)}
          role={onCardClick ? 'button' : undefined}
          aria-label={card.name}
          tabIndex={onCardClick ? 0 : undefined}
          onKeyDown={
            onCardClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onCardClick(card)
                  }
                }
              : undefined
          }
        >
          <div className="card-grid__card-image-wrap">
            <img
              src={card.imageUrl}
              alt={card.name}
              className="card-grid__card-image"
              loading="lazy"
            />
          </div>
          <div className="card-grid__card-info">
            {card.reason?.trim() && (
              <p className="card-grid__card-summary">{card.reason}</p>
            )}
          </div>
        </motion.article>
      ))}
      {hasMore && <div ref={loadMoreRef} className="card-grid__sentinel" aria-hidden />}
    </div>
  )
}
