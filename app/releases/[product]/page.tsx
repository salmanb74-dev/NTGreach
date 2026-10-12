import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicReleaseNotesList from '@/components/releases/PublicReleaseNotesList'
import { createClient } from '@/lib/supabase/server'
import type { OpsNestProduct } from '@/lib/ops/product'
import type { OpsReleaseNote } from '@/lib/ops-release-notes/types'
import styles from '../releases.module.css'

const PRODUCTS: OpsNestProduct[] = ['resto', 'alma']

function parseProduct(raw: string): OpsNestProduct | null {
  return PRODUCTS.includes(raw as OpsNestProduct)
    ? (raw as OpsNestProduct)
    : null
}

function productLabel(product: OpsNestProduct) {
  return product === 'alma' ? 'Alma' : 'Resto'
}

export function generateMetadata({
  params,
}: {
  params: { product: string }
}): Metadata {
  const product = parseProduct(params.product)
  if (!product) return { title: 'Release notes' }
  const label = productLabel(product)
  return {
    title: `${label} release notes`,
    description: `What's new in ${label}`,
  }
}

export default async function PublicReleasesPage({
  params,
}: {
  params: { product: string }
}) {
  const product = parseProduct(params.product)
  if (!product) notFound()

  const label = productLabel(product)
  const supabase = createClient()
  const { data } = await supabase
    .from('ops_release_notes')
    .select('id, title, version, body_html, published_at')
    .eq('product', product)
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  const notes = (data ?? []) as Pick<
    OpsReleaseNote,
    'id' | 'title' | 'version' | 'body_html' | 'published_at'
  >[]

  return (
    <div className={`${styles.page} ${product === 'alma' ? styles.alma : styles.resto}`}>
      <header className={styles.header}>
        <div className={styles.brand}>{label}</div>
        <h1 className={styles.title}>Release notes</h1>
        <p className={styles.lead}>What&apos;s new and improved.</p>
      </header>

      <main className={styles.main}>
        {notes.length === 0 ? (
          <p className={styles.empty}>No release notes published yet.</p>
        ) : (
          <PublicReleaseNotesList notes={notes} />
        )}
      </main>
    </div>
  )
}
