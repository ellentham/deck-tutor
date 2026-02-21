import { motion } from 'motion/react'
import './CardGrid.css'

export interface Card {
  id: string
  name: string
  typeLine: string
  manaCost: string
  imageUrl: string
}

interface CardGridProps {
  cards: Card[]
  isLoading?: boolean
  error?: string | null
}

export function CardGrid({ cards, isLoading, error }: CardGridProps) {
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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-grid__empty-message"
        >
          Searching Scryfall…
        </motion.p>
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

  return (
    <div className="card-grid">
      {cards.map((card, i) => (
        <motion.article
          key={card.id}
          className="card-grid__card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.05 }}
        >
          <div className="card-grid__card-image-wrap">
            <img
              src={card.imageUrl}
              alt={card.name}
              className="card-grid__card-image"
            />
          </div>
          <div className="card-grid__card-info">
            <h3 className="card-grid__card-name">{card.name}</h3>
            <p className="card-grid__card-type">{card.typeLine}</p>
            <p className="card-grid__card-mana">{card.manaCost}</p>
          </div>
        </motion.article>
      ))}
    </div>
  )
}
