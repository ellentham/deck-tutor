import './CardsPagination.css'

const PAGE_SIZE_OPTIONS = [24, 48, 96]

export function CardsPagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="cards-pagination">
      <div className="cards-pagination__range">
        {totalItems > 0 ? (
          <>
            {start}–{end} of {totalItems.toLocaleString()}
          </>
        ) : (
          '0 cards'
        )}
      </div>
      <div className="cards-pagination__controls">
        <select
          className="cards-pagination__size"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value))
            onPageChange(1)
          }}
          aria-label="Cards per page"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} per page
            </option>
          ))}
        </select>
        <div className="cards-pagination__nav">
          <button
            type="button"
            className="cards-pagination__btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="cards-pagination__page" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="cards-pagination__btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
