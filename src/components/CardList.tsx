import { memo } from 'react'
import { motion } from 'motion/react'
import type { Card } from '../types/card'
import { CardsEmptyState } from './CardsEmptyState'
import { useLazyLoad } from '../hooks/useLazyLoad'
import './CardList.css'

const ORACLE_PREVIEW_LENGTH = 80

function truncateOracle(text: string, maxLen = ORACLE_PREVIEW_LENGTH): string {
  if (!text.trim()) return '—'
  const single = text.replace(/\n/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen).trim() + '…'
}

const CardListRow = memo(function CardListRow({
  card,
  index,
  rankOffset,
  onCardClick,
}: {
  card: Card
  index: number
  rankOffset?: number
  onCardClick?: (card: Card) => void
}) {
  return (
    <motion.tr
      className="card-list__row"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.4) }}
    >
      <td className="card-list__td card-list__td--rank">{(rankOffset ?? 0) + index + 1}</td>
      <td className="card-list__td card-list__td--name">
        <button
          type="button"
          className="card-list__link card-list__link--button"
          onClick={() => onCardClick?.(card)}
        >
          {card.name}
        </button>
      </td>
      <td className="card-list__td card-list__td--cost">
        <span className="card-list__mana">{card.manaCost || '—'}</span>
      </td>
      <td className="card-list__td card-list__td--type">{card.typeLine || '—'}</td>
      <td className="card-list__td card-list__td--oracle">
        {truncateOracle(card.oracleText ?? '')}
      </td>
      <td className="card-list__td card-list__td--reason">
        {card.reason?.trim() || '—'}
      </td>
    </motion.tr>
  )
})

export const CardList = memo(function CardList({
  cards,
  isLoading,
  error,
  scrollContainerRef,
  onCardClick,
  rankOffset = 0,
}: {
  cards: Card[]
  isLoading?: boolean
  error?: string | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onCardClick?: (card: Card) => void
  rankOffset?: number
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
        wrapperClass="card-list"
        messageClass="card-list__empty-message"
      />
    )
  }

  return (
    <div className="card-list">
      <table className="card-list__table">
        <thead>
          <tr>
            <th className="card-list__th card-list__th--rank" scope="col">#</th>
            <th className="card-list__th card-list__th--name" scope="col">Name</th>
            <th className="card-list__th card-list__th--cost" scope="col">Cost</th>
            <th className="card-list__th card-list__th--type" scope="col">Type</th>
            <th className="card-list__th card-list__th--oracle" scope="col">Oracle text</th>
            <th className="card-list__th card-list__th--reason" scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((card, i) => (
            <CardListRow key={card.id} card={card} index={i} rankOffset={rankOffset} onCardClick={onCardClick} />
          ))}
        </tbody>
      </table>
      {hasMore && <div ref={sentinelRef} className="card-list__sentinel" aria-hidden />}
    </div>
  )
})
