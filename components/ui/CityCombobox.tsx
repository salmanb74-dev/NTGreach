'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './CityCombobox.module.css'

interface CityComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  cities?: { value: string; label: string }[]
}

export default function CityCombobox({ value, onChange, placeholder = 'e.g. Karachi', cities = [] }: CityComboboxProps) {
  const cityLabels = cities.map(c => c.label)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Keep query in sync if value changes externally
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user typed something not in list, accept it as custom city
        if (query.trim()) onChange(query.trim())
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [query, onChange])

  const filtered = query.trim() === ''
    ? cityLabels
    : cityLabels.filter(city =>
        city.toLowerCase().includes(query.toLowerCase())
      )

  const showCustom = query.trim() !== '' &&
    !cityLabels.some(c => c.toLowerCase() === query.toLowerCase())

  function handleSelect(city: string) {
    onChange(city)
    setQuery(city)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        type="text"
        className={styles.input}
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showCustom) && (
        <div className={styles.dropdown}>
          {filtered.map(city => (
            <div
              key={city}
              className={`${styles.option} ${city === value ? styles.selected : ''}`}
              onMouseDown={() => handleSelect(city)}
            >
              {city}
            </div>
          ))}
          {showCustom && (
            <div
              className={`${styles.option} ${styles.custom}`}
              onMouseDown={() => handleSelect(query.trim())}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
