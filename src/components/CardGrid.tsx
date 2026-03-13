import { memo } from 'react'
import { motion } from 'motion/react'
import type { Card } from '../types/card'
import { CardsEmptyState } from './CardsEmptyState'
import { useLazyLoad } from '../hooks/useLazyLoad'
import './CardGrid.css'

export type { Card } from '../types/card'
export { SearchingMessage } from './CardsEmptyState'

export const CardGrid = memo(function CardGrid({
  cards,
  isLoading,
  error,
  scrollContainerRef,
  onCardClick,
  isLoadingReasons,
}: {
  cards: Card[]
  isLoading?: boolean
  error?: string | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onCardClick?: (card: Card) => void
  isLoadingReasons?: boolean
}) {
  const { visibleItems, sentinelRef, hasMore } = useLazyLoad(cards, {
    scrollContainerRef,
  })

  const showEmptyState = error || (isLoading && cards.length === 0) || cards.length === 0
  if (showEmptyState) {
    return (
      <CardsEmptyState
        error={error}
        isLoading={isLoading}
        isEmpty={cards.length === 0}
        wrapperClass="card-grid"
        messageClass="card-grid__empty-message"
      />
    )
  }

  return (
    <div className="card-grid">
      {visibleItems.map((card, i) => (
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
            {card.reason?.trim() ? (
              <p className="card-grid__card-summary">{card.reason}</p>
            ) : isLoadingReasons ? (
              <p className="card-grid__card-summary card-grid__card-summary--loading">…</p>
            ) : null}
          </div>
        </motion.article>
      ))}
      {hasMore && <div ref={sentinelRef} className="card-grid__sentinel" aria-hidden />}
    </div>
  )
})
