'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MODULE_LABELS, type Module } from '@/lib/modules'
import styles from './ModuleSelector.module.css'

interface Props {
  modules:       Module[]
  activeModule:  Module
}

export default function ModuleSelector({ modules, activeModule }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSelect(mod: Module) {
    setOpen(false)
    // Store in cookie so server layout can read it
    document.cookie = `ntg-active-module=${mod};path=/;max-age=31536000`
    // Navigate to the root of the selected module
    if (mod.startsWith('crm_'))   router.push('/dashboard')
    if (mod.startsWith('cs_'))    router.push('/support')
    if (mod.startsWith('admin_')) router.push('/admin')
    router.refresh()
  }

  return (
    <div className={styles.wrap}>
      <button
        className={styles.pill}
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.pillLabel}>{MODULE_LABELS[activeModule]}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          className={open ? styles.chevronOpen : ''}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <ul className={styles.dropdown} role="listbox">
            {modules.map(mod => (
              <li key={mod}>
                <button
                  className={`${styles.option} ${mod === activeModule ? styles.optionActive : ''}`}
                  onClick={() => handleSelect(mod)}
                  role="option"
                  aria-selected={mod === activeModule}
                >
                  <span className={styles.optionDot} />
                  {MODULE_LABELS[mod]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
