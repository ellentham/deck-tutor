import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Card } from './CardGrid'
import './CardDetailModal.css'

interface CardDetailModalProps {
  card: Card | null
  onClose: () => void
}

export function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  useEffect(() => {
    if (!card) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [card, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          className="card-detail-modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className="card-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-detail-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="card-detail-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="card-detail-modal__content">
              <div className="card-detail-modal__image-wrap">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="card-detail-modal__image"
                />
              </div>
              <div className="card-detail-modal__info">
                <h1 id="card-detail-title" className="card-detail-modal__name">
                  {card.name}
                </h1>
                <p className="card-detail-modal__mana">{card.manaCost || '—'}</p>
                <p className="card-detail-modal__type">{card.typeLine || '—'}</p>
                {card.oracleText?.trim() && (
                  <div className="card-detail-modal__oracle">
                    <h3 className="card-detail-modal__oracle-title">Oracle text</h3>
                    <p className="card-detail-modal__oracle-text">{card.oracleText}</p>
                  </div>
                )}
                {card.scryfallUri && (
                  <a
                    href={card.scryfallUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-detail-modal__scryfall-link"
                  >
                    View on Scryfall →
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
