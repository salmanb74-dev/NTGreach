'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import TemplatePreview from '@/components/contracts/TemplatePreview'
import type { DocVarDef } from '@/components/documents/DocumentGenerator'
import { TEMPLATE_DATE_LOCALE } from '@/lib/subscription-quote'
import styles from '@/components/contracts/ContractTemplates.module.css'

const RichTextEditor = dynamic(
  () => import('@/components/contracts/RichTextEditor'),
  { ssr: false }
)

type Template = {
  id: string
  name: string
  is_default: boolean
  updated_at: string
}

export type TemplatesClientConfig = {
  noun: string
  variables: readonly DocVarDef[]
  templateFetchPath: (id: string) => string
  saveTemplate: (
    id: string | null,
    name: string,
    content: string
  ) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  newTemplateName: string
  newTemplateHtml: string
  editorPlaceholder: string
  emptyListHint: string
}

export default function TemplatesClient({
  config,
  templates,
  previewVars,
}: {
  config: TemplatesClientConfig
  templates: Template[]
  previewVars?: Record<string, string>
}) {
  const router = useRouter()
  const [list, setList] = useState(templates)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    setList(templates)
  }, [templates])

  async function loadTemplate(id: string) {
    const res = await fetch(config.templateFetchPath(id))
    const data = await res.json()
    setName(data.name)
    setContent(data.content)
    setPreviewing(false)
    setEditing(id)
  }

  function handleNew() {
    setName(config.newTemplateName)
    setContent(config.newTemplateHtml)
    setPreviewing(false)
    setEditing('new')
  }

  function handleSave() {
    setListError(null)
    startTransition(async () => {
      try {
        await config.saveTemplate(
          editing === 'new' ? null : editing!,
          name,
          content
        )
        setEditing(null)
        setPreviewing(false)
        router.refresh()
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function handleDelete(id: string) {
    setListError(null)
    startTransition(async () => {
      try {
        await config.deleteTemplate(id)
        setList(prev => prev.filter(t => t.id !== id))
        setConfirmDelete(null)
        router.refresh()
      } catch (err) {
        setConfirmDelete(null)
        setListError(err instanceof Error ? err.message : 'Delete failed')
        router.refresh()
      }
    })
  }

  if (editing && previewing) {
    return (
      <TemplatePreview
        title={name}
        html={content}
        variables={config.variables}
        previewVars={previewVars}
        onClose={() => setPreviewing(false)}
      />
    )
  }

  if (editing) {
    return (
      <div className={styles.editorView}>
        <div className={styles.editorHeader}>
          <input
            className={styles.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Template name"
          />
          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setEditing(null)
                setPreviewing(false)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.previewBtn}
              onClick={() => setPreviewing(true)}
            >
              Preview PDF
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>

        <div className={styles.varsBar}>
          <span className={styles.varsLabel}>Available variables:</span>
          <div className={styles.varsList}>
            {config.variables.map(v => (
              <code
                key={v.key}
                className={styles.varChip}
                title={`Insert {{${v.key}}} — e.g. ${v.example}`}
                onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
              >
                {v.label}
              </code>
            ))}
          </div>
          <span className={styles.varsHint}>
            Click to copy · {'{{= a + b}}'} ·{' '}
            {'{{#if fee > 0}}{{currency}} {{fee}}{{/if}}'} · Page ↵
          </span>
        </div>

        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder={config.editorPlaceholder}
        />
      </div>
    )
  }

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <button className={styles.newBtn} onClick={handleNew}>
          + New Template
        </button>
      </div>

      {listError && (
        <div className={styles.listError} role="alert">
          {listError}
        </div>
      )}

      {list.length === 0 && (
        <div className={styles.empty}>{config.emptyListHint}</div>
      )}

      {list.map(t => (
        <div key={t.id} className={styles.templateRow}>
          <div className={styles.templateInfo}>
            <div className={styles.templateName}>{t.name}</div>
            <div className={styles.templateMeta}>
              {t.is_default && (
                <span className={styles.defaultBadge}>Default</span>
              )}
              Updated{' '}
              {new Date(t.updated_at).toLocaleDateString(TEMPLATE_DATE_LOCALE, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
          <div className={styles.templateActions}>
            {confirmDelete === t.id ? (
              <>
                <span className={styles.confirmText}>Delete?</span>
                <button
                  className={styles.confirmDeleteBtn}
                  onClick={() => handleDelete(t.id)}
                  disabled={isPending}
                >
                  Yes
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setConfirmDelete(null)}
                >
                  No
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.editBtn}
                  onClick={() => loadTemplate(t.id)}
                >
                  Edit
                </button>
                {!t.is_default && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDelete(t.id)}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
