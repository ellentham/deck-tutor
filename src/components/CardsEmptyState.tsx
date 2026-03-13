import { useState, useEffect } from 'react'
import { motion } from 'motion/react'

const EMPTY_MESSAGE = 'No cards found. Try: lightning bolt, counterspell, or red creature'

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

interface CardsEmptyStateProps {
  error?: string | null
  isLoading?: boolean
  isEmpty?: boolean
  /** Base class for the wrapper (e.g. 'card-list' or 'card-grid') */
  wrapperClass: string
  /** Class for the message element (e.g. 'card-list__empty-message' or 'card-grid__empty-message') */
  messageClass: string
}

export function CardsEmptyState({
  error,
  isLoading,
  isEmpty,
  wrapperClass,
  messageClass,
}: CardsEmptyStateProps) {
  if (error) {
    return (
      <div className={`${wrapperClass} ${wrapperClass}--empty`}>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${messageClass} ${messageClass}--error`}
        >
          {error}
        </motion.p>
      </div>
    )
  }

  if (isLoading && isEmpty) {
    return (
      <div className={`${wrapperClass} ${wrapperClass}--empty`}>
        <SearchingMessage className={messageClass} />
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={`${wrapperClass} ${wrapperClass}--empty`}>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={messageClass}
        >
          {EMPTY_MESSAGE}
        </motion.p>
      </div>
    )
  }

  return null
}
