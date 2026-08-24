import styles from './home.module.css'

/** Ops module landing — brief intro to Reach (not the CRM pipeline dashboard). */
export default function OpsHomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.brand}>NTG Reach</p>
        <h1 className={styles.title}>Internal ops for NTG products</h1>
        <p className={styles.lead}>
          Reach is NTG’s workspace for sales, customer support, and operations
          across NTG products — in one place, with clear modules and roles.
        </p>
      </div>

      <div className={styles.sections}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you can do</h2>
          <ul className={styles.list}>
            <li>
              <strong>CRM</strong> — pipeline and lead management for NTG products.
            </li>
            <li>
              <strong>Support</strong> — live chat, coverage, and time tracking for
              customers on NTG products.
            </li>
            <li>
              <strong>Ops (Product)</strong> — manage product tenants and environment
              tools (list, inspect, logs) for NTG products.
            </li>
            <li>
              <strong>Ops</strong> — Reach platform users, Docs (OneDrive links),
              and rights across modules.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Getting around</h2>
          <p className={styles.body}>
            Use the module switcher in the top bar to move between CRM, Support,
            and Ops. Sidebar items change with the active module.
          </p>
        </section>
      </div>
    </div>
  )
}
