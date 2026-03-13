import { useState, useRef, useEffect, useMemo } from 'react'
import type { Card } from '../types/card'
import type { SortOption } from '../lib/cardSort'
import './CardsFilterPopover.css'

const COLOR_LABELS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
}

export function CardsFilterPopover({
  cards,
  selectedColors,
  selectedReasons,
  sortOption,
  isLoadingReasons,
  onColorsChange,
  onReasonsChange,
  onSortChange,
}: {
  cards: Card[]
  selectedColors: Set<string>
  selectedReasons: Set<string>
  sortOption: SortOption
  isLoadingReasons?: boolean
  onColorsChange: (colors: Set<string>) => void
  onReasonsChange: (reasons: Set<string>) => void
  onSortChange: (option: SortOption) => void
}) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const availableColors = useMemo(() => {
    const seen = new Set<string>()
    for (const card of cards) {
      const ids = card.colorIdentity ?? []
      if (ids.length === 0) seen.add('C')
      else for (const c of ids) seen.add(c)
    }
    return ['W', 'U', 'B', 'R', 'G', 'C'].filter((c) => seen.has(c))
  }, [cards])

  const availableReasons = useMemo(() => {
    const seen = new Map<string, number>()
    for (const card of cards) {
      const r = card.reason?.trim()
      if (r) seen.set(r, (seen.get(r) ?? 0) + 1)
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)
  }, [cards])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const toggleColor = (c: string) => {
    const next = new Set(selectedColors)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    onColorsChange(next)
  }

  const toggleReason = (r: string) => {
    const next = new Set(selectedReasons)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    onReasonsChange(next)
  }

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'default', label: 'Default (recommended)' },
    { value: 'name-asc', label: 'Card name A–Z' },
    { value: 'name-desc', label: 'Card name Z–A' },
    { value: 'color-identity', label: 'Color identity (WUBRG)' },
    { value: 'mana-asc', label: 'Mana cost (low to high)' },
    { value: 'price-asc', label: 'Price (low to high)' },
    { value: 'price-desc', label: 'Price (high to low)' },
  ]

  const activeFilterCount =
    selectedColors.size + selectedReasons.size + (sortOption !== 'default' ? 1 : 0)

  return (
    <div className="cards-filter">
      <button
        ref={buttonRef}
        type="button"
        className={`cards-filter__btn ${open ? 'cards-filter__btn--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Filter
        {activeFilterCount > 0 && (
          <span className="cards-filter__badge" aria-hidden>
            {activeFilterCount}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="cards-filter__popover"
          role="dialog"
          aria-label="Filter and sort cards"
        >
          <div className="cards-filter__section">
            <span className="cards-filter__label">Colors</span>
            <div className="cards-filter__colors">
              {availableColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cards-filter__color-btn cards-filter__color-btn--${c.toLowerCase()} ${selectedColors.has(c) ? 'cards-filter__color-btn--on' : ''}`}
                  onClick={() => toggleColor(c)}
                  title={COLOR_LABELS[c]}
                  aria-pressed={selectedColors.has(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="cards-filter__section">
            <span className="cards-filter__label">Strategies</span>
            {isLoadingReasons ? (
              <p className="cards-filter__reasons-loading">Loading strategy labels…</p>
            ) : availableReasons.length > 0 ? (
              <div className="cards-filter__reasons">
                {availableReasons.map((r) => (
                  <label key={r} className="cards-filter__reason-row">
                    <input
                      type="checkbox"
                      checked={selectedReasons.has(r)}
                      onChange={() => toggleReason(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="cards-filter__reasons-empty">
                No strategy labels yet. They appear after the AI analyzes the cards.
              </p>
            )}
          </div>

          <div className="cards-filter__section">
            <span className="cards-filter__label">Sort by</span>
            <select
              className="cards-filter__sort"
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
