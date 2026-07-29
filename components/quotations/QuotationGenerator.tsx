'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { QUOTATION_VARIABLES, QUOTATION_DEAL_KEYS, substituteQuotationVariables } from '@/lib/quotations'
import { saveQuotation } from '@/lib/actions/quotations'
import styles from '@/components/contracts/ContractGenerator.module.css'

const RichTextEditor = dynamic(() => import('@/components/contracts/RichTextEditor'), { ssr: false })

interface Template { id: string; name: string; is_default: boolean }

interface Props {
  templates:     Template[]
  lead:          any
  prefilled:     Record<string, string>
  inputCurrency: string
}

type Step = 'variables' | 'preview' | 'saved'

export default function QuotationGenerator({ templates, lead, prefilled, inputCurrency }: Props) {
  const defaultTemplate = templates.find(t => t.is_default) ?? templates[0]
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate.id)
  const [templateContent, setTemplateContent]       = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate]       = useState(false)
  const [variables, setVariables]                   = useState<Record<string, string>>(prefilled)
  const [editedContent, setEditedContent]           = useState<string | null>(null)
  const [step, setStep]                             = useState<Step>('variables')
  const [quotationName, setQuotationName]           = useState(
    lead ? `${lead.company_name} — Quotation` : 'New Quotation'
  )
  const [isPending, startTransition] = useTransition()

  async function loadTemplateContent(id: string) {
    setLoadingTemplate(true)
    const res  = await fetch(`/api/quotations/template/${id}`)
    const data = await res.json()
    setTemplateContent(data.content)
    setEditedContent(null)
    setLoadingTemplate(false)
  }

  async function handlePreview() {
    if (!templateContent) await loadTemplateContent(selectedTemplateId)
    setStep('preview')
  }

  function getRenderedContent() {
    const base = editedContent ?? templateContent ?? ''
    return substituteQuotationVariables(base, variables)
  }

  function handleSave() {
    startTransition(async () => {
      const rendered = getRenderedContent()
      await saveQuotation({
        lead_id:     lead?.id,
        template_id: selectedTemplateId,
        name:        quotationName,
        content:     rendered,
        variables,
      })
      setStep('saved')
    })
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${quotationName}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a18; max-width: 800px; margin: 40px auto; padding: 0 40px; }
            h1 { font-size: 20pt; margin-bottom: 8px; }
            h2 { font-size: 13pt; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
            p { margin: 0 0 10px; }
            ul, ol { padding-left: 20px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            td, th { padding: 8px 12px; border: 1px solid #e5e7eb; }
            hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${getRenderedContent()}</body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  // ── Step: Variables ────────────────────────────────────────
  if (step === 'variables') {
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>Fill Quotation Variables</div>
          <div className={styles.stepDesc}>These values will be substituted into the template</div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.formPanel}>
            <div className={styles.field}>
              <label className={styles.label}>Template</label>
              <select
                className={styles.select}
                value={selectedTemplateId}
                onChange={e => { setSelectedTemplateId(e.target.value); setTemplateContent(null); setEditedContent(null) }}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Quotation Name (for your records)</label>
              <input
                className={styles.input}
                value={quotationName}
                onChange={e => setQuotationName(e.target.value)}
                placeholder="e.g. Spice Garden — Q1 2026 Quotation"
              />
            </div>

            <div className={styles.varsDivider}>Variable Values</div>

            {QUOTATION_VARIABLES.filter(v => !QUOTATION_DEAL_KEYS.has(v.key)).map(v => (
              <div key={v.key} className={styles.field}>
                <label className={styles.label}>
                  {v.label}
                  <code className={styles.varCode}>{`{{${v.key}}}`}</code>
                </label>
                <input
                  className={styles.input}
                  value={variables[v.key] ?? ''}
                  onChange={e => setVariables(prev => ({ ...prev, [v.key]: e.target.value }))}
                  placeholder={v.example}
                />
              </div>
            ))}

            <div className={styles.varsDivider}>From Deal Panel (read-only)</div>

            {QUOTATION_VARIABLES.filter(v => QUOTATION_DEAL_KEYS.has(v.key)).map(v => (
              <div key={v.key} className={styles.field}>
                <label className={styles.label}>
                  {v.label}
                  <code className={styles.varCode}>{`{{${v.key}}}`}</code>
                </label>
                <input
                  className={`${styles.input} ${styles.readOnly}`}
                  value={variables[v.key] ?? ''}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            ))}

          </div>

          <div className={styles.previewSnippet}>
            <div className={styles.previewLabel}>Variable Summary</div>
            <div className={styles.previewNote}>
              Review before previewing. Unfilled variables show as highlighted placeholders.
            </div>
            <div className={styles.varsSummary}>
              {QUOTATION_VARIABLES.map(v => (
                <div key={v.key} className={styles.varRow}>
                  <code className={styles.varKey}>{`{{${v.key}}}`}</code>
                  <span className={`${styles.varValue} ${!variables[v.key] ? styles.varEmpty : ''}`}>
                    {variables[v.key] || '(empty)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.previewBtn} onClick={handlePreview} disabled={loadingTemplate}>
            {loadingTemplate ? 'Loading…' : 'Preview Quotation →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Preview ──────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>Preview & Edit</div>
          <div className={styles.stepDesc}>Review the quotation. You can edit directly before saving.</div>
        </div>

        <div className={styles.previewActions}>
          <button className={styles.backBtn} onClick={() => setStep('variables')}>← Back</button>
          <button className={styles.printBtn} onClick={handlePrint}>🖨 Print / Save as PDF</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : '💾 Save Quotation'}
          </button>
        </div>

        <RichTextEditor content={getRenderedContent()} onChange={setEditedContent} />

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Saved ────────────────────────────────────────────
  return (
    <div className={styles.saved}>
      <div className={styles.savedIcon}>✓</div>
      <div className={styles.savedTitle}>Quotation saved</div>
      <div className={styles.savedSub}>{quotationName}</div>
      <div className={styles.savedActions}>
        <button className={styles.printBtn} onClick={handlePrint}>🖨 Print / Save as PDF</button>
        {lead && (
          <a href={`/leads/${lead.id}`} className={styles.backToLead}>← Back to lead</a>
        )}
        <button className={styles.backBtn} onClick={() => { setStep('variables') }}>
          Create another
        </button>
      </div>
    </div>
  )
}
