import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Card } from './CardGrid'
import { SearchingMessage } from './CardGrid'
import { parseManaValue, sortByRelevance } from '../lib/cardSort'
import './CardList.css'

const INITIAL_BATCH = 24
const LOAD_MORE_BATCH = 24
const ORACLE_PREVIEW_LENGTH = 80

type SortColumn = 'relevance' | 'name' | 'cost' | 'type' | 'oracle' | 'reason'
type SortDir = 'asc' | 'desc'

function truncateOracle(text: string, maxLen = ORACLE_PREVIEW_LENGTH): string {
  if (!text.trim()) return '—'
  const single = text.replace(/\n/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen).trim() + '…'
}

function getSortValue(card: Card, col: SortColumn): string {
  switch (col) {
    case 'relevance':
      return '' // Preserve API order
    case 'name':
      return card.name.toLowerCase()
    case 'cost':
      return card.manaCost ?? ''
    case 'type':
      return (card.typeLine ?? '').toLowerCase()
    case 'oracle':
      return (card.oracleText ?? '').toLowerCase()
    case 'reason':
      return (card.reason ?? '').toLowerCase()
    default:
      return ''
  }
}

function sortCards(cards: Card[], col: SortColumn, dir: SortDir): Card[] {
  if (col === 'relevance') return sortByRelevance(cards)
  return [...cards].sort((a, b) => {
    if (col === 'cost') {
      const va = parseManaValue(a.manaCost)
      const vb = parseManaValue(b.manaCost)
      const cmp = va - vb
      return dir === 'asc' ? cmp : -cmp
    }
    const va = getSortValue(a, col)
    const vb = getSortValue(b, col)
    const emptyLast = dir === 'asc' ? 1 : -1
    if (!va && !vb) return 0
    if (!va) return emptyLast
    if (!vb) return -emptyLast
    const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
}

interface CardListProps {
  cards: Card[]
  isLoading?: boolean
  error?: string | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onCardClick?: (card: Card) => void
}

export function CardList({ cards, isLoading, error, scrollContainerRef, onCardClick }: CardListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const [sortBy, setSortBy] = useState<SortColumn>('relevance')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const sortedCards = useMemo(() => sortCards(cards, sortBy, sortDir), [cards, sortBy, sortDir])

  const handleSort = (col: SortColumn) => {
    if (col === 'relevance') {
      setSortBy('relevance')
      return
    }
    setSortBy(col)
    setSortDir((d) => (sortBy === col && d === 'asc' ? 'desc' : 'asc'))
  }

  useEffect(() => {
    setVisibleCount(INITIAL_BATCH)
  }, [cards])

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
      <div className="card-list card-list--empty">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-list__empty-message card-list__empty-message--error"
        >
          {error}
        </motion.p>
      </div>
    )
  }

  if (isLoading && cards.length === 0) {
    return (
      <div className="card-list card-list--empty">
        <SearchingMessage className="card-list__empty-message" />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="card-list card-list--empty">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="card-list__empty-message"
        >
          No cards found. Try: lightning bolt, counterspell, or red creature
        </motion.p>
      </div>
    )
  }

  const visibleCards = sortedCards.slice(0, visibleCount)
  const hasMore = visibleCount < sortedCards.length

  const SortHeader = ({ col, label }: { col: SortColumn; label: string }) => (
    <th
      className={`card-list__th card-list__th--${col} card-list__th--sortable`}
      scope="col"
    >
      <button
        type="button"
        className="card-list__sort-btn"
        onClick={() => handleSort(col)}
        aria-sort={sortBy === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        {label}
        {sortBy === col && col !== 'relevance' && (
          <span className="card-list__sort-icon" aria-hidden>
            {sortDir === 'asc' ? ' ↑' : ' ↓'}
          </span>
        )}
      </button>
    </th>
  )

  return (
    <div className="card-list">
      <table className="card-list__table">
        <thead>
          <tr>
            <SortHeader col="relevance" label="Best" />
            <SortHeader col="name" label="Name" />
            <SortHeader col="cost" label="Cost" />
            <SortHeader col="type" label="Type" />
            <SortHeader col="oracle" label="Oracle text" />
            <SortHeader col="reason" label="Why" />
          </tr>
        </thead>
        <tbody>
          {visibleCards.map((card, i) => (
            <motion.tr
              key={card.id}
              className="card-list__row"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
            >
              <td className="card-list__td card-list__td--rank">
                {i + 1}
              </td>
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
          ))}
        </tbody>
      </table>
      {hasMore && <div ref={loadMoreRef} className="card-list__sentinel" aria-hidden />}
    </div>
  )
}
