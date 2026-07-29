import Link from 'next/link'
import styles from './LeadsPagination.module.css'

interface PaginationProps {
  currentPage: number
  totalPages: number
  searchParams: Record<string, string | undefined>
}

function buildUrl(searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  if (searchParams.q)     params.set('q', searchParams.q)
  if (searchParams.stage) params.set('stage', searchParams.stage)
  if (searchParams.sort)  params.set('sort', searchParams.sort)
  params.set('page', String(page))
  return `/leads?${params.toString()}`
}

export default function LeadsPagination({ currentPage, totalPages, searchParams }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  // Show max 7 page numbers with ellipsis
  const getVisiblePages = () => {
    if (totalPages <= 7) return pages
    if (currentPage <= 4) return [...pages.slice(0, 5), -1, totalPages]
    if (currentPage >= totalPages - 3) return [1, -1, ...pages.slice(totalPages - 5)]
    return [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages]
  }

  return (
    <div className={styles.pagination}>
      {/* Prev */}
      {currentPage > 1 ? (
        <Link href={buildUrl(searchParams, currentPage - 1)} className={styles.btn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Prev
        </Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Prev
        </span>
      )}

      {/* Page numbers */}
      <div className={styles.pages}>
        {getVisiblePages().map((p, i) =>
          p === -1 ? (
            <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
          ) : (
            <Link
              key={p}
              href={buildUrl(searchParams, p)}
              className={`${styles.page} ${p === currentPage ? styles.active : ''}`}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={buildUrl(searchParams, currentPage + 1)} className={styles.btn}>
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </span>
      )}
    </div>
  )
}
