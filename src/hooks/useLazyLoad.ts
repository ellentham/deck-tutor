import { useEffect, useRef, useState } from 'react'

const INITIAL_BATCH = 24
const LOAD_MORE_BATCH = 24

interface UseLazyLoadOptions {
  /** Scroll container for IntersectionObserver (uses viewport if null) */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  initialCount?: number
  batchSize?: number
}

export function useLazyLoad<T>(
  items: T[],
  options: UseLazyLoadOptions = {}
): {
  visibleItems: T[]
  sentinelRef: React.RefObject<HTMLDivElement>
  hasMore: boolean
} {
  const {
    scrollContainerRef,
    initialCount = INITIAL_BATCH,
    batchSize = LOAD_MORE_BATCH,
  } = options

  const [visibleCount, setVisibleCount] = useState(initialCount)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(initialCount)
  }, [items, initialCount])

  useEffect(() => {
    if (visibleCount >= items.length) return
    const el = sentinelRef.current
    const root = scrollContainerRef?.current ?? null
    if (!el || (scrollContainerRef && !root)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + batchSize, items.length))
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, items.length, scrollContainerRef, batchSize])

  return {
    visibleItems: items.slice(0, visibleCount),
    sentinelRef,
    hasMore: visibleCount < items.length,
  }
}
