import Link from 'next/link'
import type { Metadata } from 'next'
import styles from './releases.module.css'

export const metadata: Metadata = {
  title: 'Release notes',
  description: 'Resto and Alma product release notes',
}

export default function ReleasesIndexPage() {
  return (
    <div className={`${styles.page} ${styles.resto}`}>
      <header className={styles.header}>
        <div className={styles.brand}>NTG</div>
        <h1 className={styles.title}>Release notes</h1>
        <p className={styles.lead}>Choose a product to see what&apos;s new.</p>
      </header>
      <main className={styles.main}>
        <ul className={styles.list}>
          <li className={styles.item}>
            <h2 className={styles.itemTitle}>
              <Link href="/releases/resto">Resto</Link>
            </h2>
          </li>
          <li className={styles.item}>
            <h2 className={styles.itemTitle}>
              <Link href="/releases/alma">Alma</Link>
            </h2>
          </li>
        </ul>
      </main>
    </div>
  )
}
