'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { openTemplatePrintWindow } from '@/lib/template-print'
import { substituteTemplateHtml } from '@/lib/template-vars'
import styles from '@/components/contracts/ContractGenerator.module.css'

const RichTextEditor = dynamic(
  () => import('@/components/contracts/RichTextEditor'),
  { ssr: false }
)

export type DocVarDef = { key: string; label: string; example: string }

export type DocumentTemplateRow = {
  id: string
  name: string
  is_default: boolean
}

export type DocumentGeneratorConfig = {
  kind: 'contract' | 'quotation'
  noun: string // "Contract" | "Quotation"
  variables: readonly DocVarDef[]
  dealKeys: Set<string>
  templateFetchPath: (id: string) => string
  saveDocument: (data: {
    lead_id?: string
    template_id?: string
    name: string
    content: string
    variables: Record<string, string>
  }) => Promise<{ id?: string } | void>
  namePlaceholder: string
  summaryLabel?: string
}

type Step = 'variables' | 'preview' | 'saved'

type Props = {
  config: DocumentGeneratorConfig
  templates: DocumentTemplateRow[]
  lead: { id: string; company_name: string } | null
  prefilled: Record<string, string>
}

export default function DocumentGenerator({
  config,
  templates,
  lead,
  prefilled,
}: Props) {
  const defaultTemplate = templates.find(t => t.is_default) ?? templates[0]
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    defaultTemplate.id
  )
  const [templateContent, setTemplateContent] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [variables, setVariables] =
    useState<Record<string, string>>(prefilled)
  const [editedContent, setEditedContent] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('variables')
  const [docName, setDocName] = useState(
    lead ? `${lead.company_name} — ${config.noun}` : `New ${config.noun}`
  )
  const [isPending, startTransition] = useTransition()

  const manualVars = config.variables.filter(v => !config.dealKeys.has(v.key))
  const dealVars = config.variables.filter(
    v => config.dealKeys.has(v.key) && (variables[v.key] ?? '').trim() !== ''
  )

  async function loadTemplateContent(id: string) {
    setLoadingTemplate(true)
    const res = await fetch(config.templateFetchPath(id))
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
    return substituteTemplateHtml(
      editedContent ?? templateContent ?? '',
      variables
    )
  }

  function handleSave() {
    startTransition(async () => {
      await config.saveDocument({
        lead_id: lead?.id,
        template_id: selectedTemplateId,
        name: docName,
        content: getRenderedContent(),
        variables,
      })
      setStep('saved')
    })
  }

  function handlePrint() {
    openTemplatePrintWindow(docName, getRenderedContent())
  }

  if (step === 'variables') {
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>
            Fill {config.noun} Variables
          </div>
          <div className={styles.stepDesc}>
            These values will be substituted into the template
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.formPanel}>
            <div className={styles.field}>
              <label className={styles.label}>Template</label>
              <select
                className={styles.select}
                value={selectedTemplateId}
                onChange={e => {
                  setSelectedTemplateId(e.target.value)
                  setTemplateContent(null)
                  setEditedContent(null)
                }}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                {config.noun} Name (for your records)
              </label>
              <input
                className={styles.input}
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder={config.namePlaceholder}
              />
            </div>

            <div className={styles.varsDivider}>Variable Values</div>

            {manualVars.map(v => (
              <div key={v.key} className={styles.field}>
                <label className={styles.label}>{v.label}</label>
                <input
                  className={styles.input}
                  value={variables[v.key] ?? ''}
                  onChange={e =>
                    setVariables(prev => ({
                      ...prev,
                      [v.key]: e.target.value,
                    }))
                  }
                  placeholder={v.example}
                />
              </div>
            ))}

            <div className={styles.varsDivider}>From Deal Panel (read-only)</div>

            {dealVars.map(v => (
              <div key={v.key} className={styles.field}>
                <label className={styles.label}>{v.label}</label>
                <input
                  className={`${styles.input} ${styles.readOnly}`}
                  value={variables[v.key] ?? ''}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            ))}
            {dealVars.length === 0 && (
              <div className={styles.previewNote}>
                No deal values on this lead yet. Save Deal Values on the lead,
                then reopen Generate {config.noun}.
              </div>
            )}
          </div>

          <div className={styles.previewSnippet}>
            <div className={styles.previewLabel}>
              {config.summaryLabel ?? 'Variable Summary'}
            </div>
            <div className={styles.previewNote}>
              Review before previewing. Unfilled variables show as highlighted
              placeholders.
            </div>
            <div className={styles.varsSummary}>
              {config.variables.map(v => (
                <div key={v.key} className={styles.varRow}>
                  <span className={styles.varKey}>{v.label}</span>
                  <span
                    className={`${styles.varValue} ${!variables[v.key] ? styles.varEmpty : ''}`}
                  >
                    {variables[v.key] || '(empty)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.previewBtn}
            onClick={handlePreview}
            disabled={loadingTemplate}
          >
            {loadingTemplate
              ? 'Loading…'
              : `Preview ${config.noun} →`}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className={styles.wrap}>
        <div className={styles.stepHeader}>
          <div className={styles.stepTitle}>Preview & Edit</div>
          <div className={styles.stepDesc}>
            Review the {config.noun.toLowerCase()}. You can edit directly before
            saving.
          </div>
        </div>

        <div className={styles.previewActions}>
          <button
            className={styles.backBtn}
            onClick={() => setStep('variables')}
          >
            ← Back
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            🖨 Print / Save as PDF
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : `💾 Save ${config.noun}`}
          </button>
        </div>

        <RichTextEditor
          content={getRenderedContent()}
          onChange={setEditedContent}
        />

        <div className={styles.footer}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : `Save ${config.noun}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.saved}>
      <div className={styles.savedIcon}>✓</div>
      <div className={styles.savedTitle}>{config.noun} saved</div>
      <div className={styles.savedSub}>{docName}</div>
      <div className={styles.savedActions}>
        <button className={styles.printBtn} onClick={handlePrint}>
          🖨 Print / Save as PDF
        </button>
        {lead && (
          <a href={`/leads/${lead.id}`} className={styles.backToLead}>
            ← Back to lead
          </a>
        )}
        <button
          className={styles.backBtn}
          onClick={() => setStep('variables')}
        >
          Create another
        </button>
      </div>
    </div>
  )
}
