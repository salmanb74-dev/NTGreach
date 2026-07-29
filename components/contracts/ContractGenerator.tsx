'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { CONTRACT_VARIABLES, CONTRACT_DEAL_KEYS, substituteVariables } from '@/lib/contracts'
import { saveContract } from '@/lib/actions/contracts'
import styles from './ContractGenerator.module.css'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

interface Template { id: string; name: string; is_default: boolean }

interface Props {
  templates:      Template[]
  lead:           any
  prefilled:      Record<string, string>
  inputCurrency:  string
}

type Step = 'variables' | 'preview' | 'saved'

export default function ContractGenerator({ templates, lead, prefilled, inputCurrency }: Props) {
  const defaultTemplate = templates.find(t => t.is_default) ?? templates[0]
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate.id)
  const [templateContent, setTemplateContent] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [variables, setVariables] = useState<Record<string, string>>(prefilled)
  const [editedContent, setEditedContent] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('variables')
  const [contractName, setContractName] = useState(
    lead ? `${lead.company_name} — Contract` : 'New Contract'
  )
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadTemplateContent(id: string) {
    setLoadingTemplate(true)
    const res = await fetch(`/api/contracts/template/${id}`)
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
    return substituteVariables(base, variables)
  }

  function handleSave() {
    startTransition(async () => {
      const rendered = getRenderedContent()
      const contract = await saveContract({
        lead_id:     lead?.id,
        template_id: selectedTemplateId,
        name:        contractName,
        content:     rendered,
        variables,
      })
      setSavedId(contract.id)
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
          <title>${contractName}</title>
          <style>
            body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.7; color: #1a1a18; max-width: 800px; margin: 40px auto; padding: 0 40px; }
            h1 { font-size: 18pt; text-align: center; margin-bottom: 20px; }
            h2 { font-size: 13pt; margin-top: 24px; margin-bottom: 8px; }
            p { margin: 0 0 10px; }
            ul, ol { padding-left: 20px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 4px 8px; vertical-align: top; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${getRenderedContent()}</body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  // ── Step: Variables form ──
  if (step === 'variables') {
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>Fill Contract Variables</div>
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
              <label className={styles.label}>Contract Name (for your records)</label>
              <input
                className={styles.input}
                value={contractName}
                onChange={e => setContractName(e.target.value)}
                placeholder="e.g. Spice Garden — Q1 2026 Contract"
              />
            </div>

            <div className={styles.varsDivider}>Variable Values</div>

            {CONTRACT_VARIABLES.filter(v => !CONTRACT_DEAL_KEYS.has(v.key)).map(v => (
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

            {CONTRACT_VARIABLES.filter(v => CONTRACT_DEAL_KEYS.has(v.key)).map(v => (
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
            <div className={styles.previewLabel}>Live Preview</div>
            <div className={styles.previewNote}>
              Full preview on next step. Variables shown as{' '}
              <span className={styles.previewHighlight}>highlighted</span> if not filled.
            </div>
            <div className={styles.varsSummary}>
              {CONTRACT_VARIABLES.map(v => (
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
            {loadingTemplate ? 'Loading…' : 'Preview Contract →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Preview + edit ──
  if (step === 'preview') {
    const rendered = getRenderedContent()
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>Preview & Edit</div>
          <div className={styles.stepDesc}>Review the contract. You can edit directly below before saving.</div>
        </div>

        <div className={styles.previewActions}>
          <button className={styles.backBtn} onClick={() => setStep('variables')}>← Back</button>
          <button className={styles.printBtn} onClick={handlePrint}>
            🖨 Print / Save as PDF
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : '💾 Save Contract'}
          </button>
        </div>

        <RichTextEditor content={rendered} onChange={setEditedContent} />

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Contract'}
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Saved ──
  return (
    <div className={styles.saved}>
      <div className={styles.savedIcon}>✓</div>
      <div className={styles.savedTitle}>Contract saved</div>
      <div className={styles.savedSub}>{contractName}</div>
      <div className={styles.savedActions}>
        <button className={styles.printBtn} onClick={handlePrint}>🖨 Print / Save as PDF</button>
        {lead && (
          <a href={`/leads/${lead.id}`} className={styles.backToLead}>← Back to lead</a>
        )}
        <button className={styles.backBtn} onClick={() => { setStep('variables'); setSavedId(null) }}>
          Create another
        </button>
      </div>
    </div>
  )
}
