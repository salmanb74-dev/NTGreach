'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { saveTemplate, deleteTemplate } from '@/lib/actions/contracts'
import { CONTRACT_VARIABLES } from '@/lib/contracts'
import styles from './ContractTemplates.module.css'

// Lazy load TipTap to avoid SSR issues
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

interface Template {
  id: string
  name: string
  is_default: boolean
  updated_at: string
}

export default function ContractTemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function loadTemplate(id: string) {
    const res = await fetch(`/api/contracts/template/${id}`)
    const data = await res.json()
    setName(data.name)
    setContent(data.content)
    setEditing(id)
  }

  function handleNew() {
    setName('New Template')
    setContent('<h1>CONTRACT TITLE</h1><p>Enter contract content here. Use <strong>{{variable}}</strong> placeholders.</p>')
    setEditing('new')
  }

  function handleSave() {
    startTransition(async () => {
      await saveTemplate(editing === 'new' ? null : editing!, name, content)
      setEditing(null)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTemplate(id)
      setConfirmDelete(null)
      router.refresh()
    })
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
            <button className={styles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* Variable reference */}
        <div className={styles.varsBar}>
          <span className={styles.varsLabel}>Available variables:</span>
          <div className={styles.varsList}>
            {CONTRACT_VARIABLES.map(v => (
              <code
                key={v.key}
                className={styles.varChip}
                title={`${v.label} — e.g. ${v.example}`}
                onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
              >
                {`{{${v.key}}}`}
              </code>
            ))}
          </div>
          <span className={styles.varsHint}>Click to copy</span>
        </div>

        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Write your contract template here…"
        />
      </div>
    )
  }

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <button className={styles.newBtn} onClick={handleNew}>+ New Template</button>
      </div>

      {templates.length === 0 && (
        <div className={styles.empty}>No templates yet. The default will be created when you run the Phase E migration.</div>
      )}

      {templates.map(t => (
        <div key={t.id} className={styles.templateRow}>
          <div className={styles.templateInfo}>
            <div className={styles.templateName}>{t.name}</div>
            <div className={styles.templateMeta}>
              {t.is_default && <span className={styles.defaultBadge}>Default</span>}
              Updated {new Date(t.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className={styles.templateActions}>
            {confirmDelete === t.id ? (
              <>
                <span className={styles.confirmText}>Delete?</span>
                <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(t.id)} disabled={isPending}>Yes</button>
                <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>No</button>
              </>
            ) : (
              <>
                <button className={styles.editBtn} onClick={() => loadTemplate(t.id)}>Edit</button>
                {!t.is_default && (
                  <button className={styles.deleteBtn} onClick={() => setConfirmDelete(t.id)}>Delete</button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
