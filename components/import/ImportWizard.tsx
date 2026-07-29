'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { importLeads, type ImportRow, type ImportResult } from '@/lib/actions/import'
import Button from '@/components/ui/Button'
import styles from './ImportWizard.module.css'

// CRM fields that can be mapped
const CRM_FIELDS = [
  { key: 'contact_name',    label: 'Contact Name',    required: true  },
  { key: 'company_name',    label: 'Company Name',    required: true  },
  { key: 'email',           label: 'Email',           required: false },
  { key: 'phone',           label: 'Phone',           required: false },
  { key: 'city',            label: 'City',            required: false },
  { key: 'restaurant_type', label: 'Restaurant Type', required: false },
  { key: 'source',          label: 'Source',          required: false },
  { key: 'stage',           label: 'Stage',           required: false },
  { key: 'notes',           label: 'Notes',           required: false },
]

type Step = 1 | 2 | 3 | 4

// ─── Step indicator ───────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const steps = ['Upload', 'Map Columns', 'Preview', 'Done']
  return (
    <div className={styles.steps}>
      {steps.map((label, i) => {
        const num = (i + 1) as Step
        const done    = current > num
        const active  = current === num
        return (
          <div key={label} className={styles.stepItem}>
            <div className={`${styles.stepCircle} ${done ? styles.done : active ? styles.active : ''}`}>
              {done ? '✓' : num}
            </div>
            <span className={`${styles.stepLabel} ${active ? styles.activeLabel : ''}`}>{label}</span>
            {i < steps.length - 1 && <div className={`${styles.stepLine} ${done ? styles.doneLine : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────
export default function ImportWizard() {
  const router = useRouter()
  const [step, setStep]         = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders]   = useState<string[]>([])
  const [rawRows, setRawRows]   = useState<string[][]>([])
  const [mapping, setMapping]   = useState<Record<string, string>>({}) // crmField → excelCol
  const [preview, setPreview]   = useState<ImportRow[]>([])
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // ── Step 1: File upload ──────────────────────────────────────
  async function handleFile(file: File) {
    if (!file) return
    setFileName(file.name)

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (data.length < 2) return

    const hdrs = (data[0] as string[]).map(h => String(h).trim())
    const rows = data.slice(1).filter(r => r.some(cell => cell !== '')) as string[][]

    setHeaders(hdrs)
    setRawRows(rows)

    // Auto-map obvious column names
    const autoMap: Record<string, string> = {}
    CRM_FIELDS.forEach(field => {
      const match = hdrs.find(h => {
        const hl = h.toLowerCase().replace(/[\s_-]/g, '')
        const fl = field.key.replace(/_/g, '')
        const ll = field.label.toLowerCase().replace(/[\s_-]/g, '')
        return hl === fl || hl === ll || hl.includes(fl) || hl.includes(ll.slice(0, 5))
      })
      if (match) autoMap[field.key] = match
    })
    setMapping(autoMap)
    setStep(2)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Step 2: Build preview from mapping ──────────────────────
  function buildPreview() {
    const rows = rawRows.slice(0, 5).map(row => {
      const obj: any = {}
      CRM_FIELDS.forEach(field => {
        const col = mapping[field.key]
        if (col) {
          const idx = headers.indexOf(col)
          obj[field.key] = idx >= 0 ? String(row[idx] ?? '').trim() : ''
        }
      })
      return obj as ImportRow
    })
    setPreview(rows)
    setStep(3)
  }

  // ── Step 3: Run import ───────────────────────────────────────
  async function handleImport() {
    setImporting(true)
    const allRows = rawRows.map(row => {
      const obj: any = {}
      CRM_FIELDS.forEach(field => {
        const col = mapping[field.key]
        if (col) {
          const idx = headers.indexOf(col)
          obj[field.key] = idx >= 0 ? String(row[idx] ?? '').trim() : ''
        }
      })
      return obj as ImportRow
    })

    try {
      const res = await importLeads(allRows)
      setResult(res)
      setStep(4)
    } finally {
      setImporting(false)
    }
  }

  const requiredMapped = CRM_FIELDS
    .filter(f => f.required)
    .every(f => mapping[f.key])

  return (
    <div className={styles.wizard}>
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className={styles.card}>
          <div
            className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={styles.uploadIcon}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className={styles.dropText}>Drop your Excel or CSV file here</div>
            <div className={styles.dropHint}>or click to browse · .xlsx, .xls, .csv supported</div>
            <input
              id="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              className={styles.fileInput}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className={styles.templateHint}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>
              Your file can use any column names — you'll map them in the next step.
              Minimum required: <strong>Contact Name</strong> and <strong>Company Name</strong>.
              {' '}
              <a href="/api/leads/template" download className={styles.templateLink}>
                Download blank template →
              </a>
            </span>
          </div>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && (
        <div className={styles.card}>
          <div className={styles.fileTag}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            {fileName} · {rawRows.length} rows detected
          </div>

          <div className={styles.mappingGrid}>
            <div className={styles.mappingHeader}>
              <span>CRM Field</span>
              <span>Your Excel Column</span>
            </div>
            {CRM_FIELDS.map(field => (
              <div key={field.key} className={styles.mappingRow}>
                <div className={styles.mappingField}>
                  {field.label}
                  {field.required && <span className={styles.required}>*</span>}
                </div>
                <select
                  className={styles.mappingSelect}
                  value={mapping[field.key] ?? ''}
                  onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">— skip this field —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {!requiredMapped && (
            <div className={styles.warn}>
              Please map <strong>Contact Name</strong> and <strong>Company Name</strong> to continue.
            </div>
          )}

          <div className={styles.cardFooter}>
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={buildPreview} disabled={!requiredMapped}>Preview →</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && (
        <div className={styles.card}>
          <div className={styles.previewInfo}>
            Showing first {preview.length} of {rawRows.length} rows. Duplicates (same email or phone) will be skipped automatically.
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {CRM_FIELDS.filter(f => mapping[f.key]).map(f => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {CRM_FIELDS.filter(f => mapping[f.key]).map(f => (
                      <td key={f.key}>{(row as any)[f.key] || <span className={styles.empty}>—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardFooter}>
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Import all ${rawRows.length} rows →`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Result ── */}
      {step === 4 && result && (
        <div className={styles.card}>
          <div className={styles.resultHeader}>
            <div className={styles.resultIcon}>✓</div>
            <div className={styles.resultTitle}>Import complete</div>
          </div>

          <div className={styles.resultStats}>
            <div className={styles.resultStat}>
              <div className={styles.resultNum} style={{ color: 'var(--color-success)' }}>{result.inserted}</div>
              <div className={styles.resultLbl}>Leads imported</div>
            </div>
            <div className={styles.resultStat}>
              <div className={styles.resultNum} style={{ color: 'var(--color-warning)' }}>{result.skipped}</div>
              <div className={styles.resultLbl}>Skipped</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className={styles.errorList}>
              <div className={styles.errorListTitle}>Skipped rows:</div>
              {result.errors.map((e, i) => (
                <div key={i} className={styles.errorRow}>{e}</div>
              ))}
            </div>
          )}

          <div className={styles.cardFooter} style={{ justifyContent: 'center' }}>
            <Button onClick={() => router.push('/leads')}>View Leads</Button>
            <Button variant="outline" onClick={() => { setStep(1); setFileName(''); setHeaders([]); setRawRows([]); setMapping({}); setResult(null) }}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
