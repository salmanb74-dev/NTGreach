'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import {
  openTemplatePrintWindow,
  packHtmlIntoPageChunks,
  renderTemplatePreview,
  splitHtmlByPageBreaks,
  type TemplateVarDef,
} from '@/lib/template-print'
import styles from './ContractTemplates.module.css'

/** A4 at 96dpi */
const PAGE_WIDTH_PX = 794
const PAGE_HEIGHT_PX = 1123
const PAGE_PAD_X = 56
const PAGE_PAD_Y = 64
const CONTENT_WIDTH = PAGE_WIDTH_PX - PAGE_PAD_X * 2
const CONTENT_HEIGHT = PAGE_HEIGHT_PX - PAGE_PAD_Y * 2

interface Props {
  title: string
  html: string
  variables: readonly TemplateVarDef[]
  /** Prefer Settings deal defaults over catalog examples. */
  previewVars?: Record<string, string>
  onClose: () => void
}

export default function TemplatePreview({
  title,
  html,
  variables,
  previewVars,
  onClose,
}: Props) {
  const rendered = useMemo(
    () => renderTemplatePreview(html, variables, previewVars),
    [html, variables, previewVars]
  )

  const [pages, setPages] = useState<string[]>(() =>
    splitHtmlByPageBreaks(rendered)
  )

  useLayoutEffect(() => {
    const segments = splitHtmlByPageBreaks(rendered)
    const packed = segments.flatMap(seg =>
      packHtmlIntoPageChunks(seg, CONTENT_WIDTH, CONTENT_HEIGHT)
    )
    setPages(packed.length > 0 ? packed : [''])
  }, [rendered])

  function handlePrint() {
    openTemplatePrintWindow(title || 'Template preview', rendered)
  }

  return (
    <div className={styles.previewView}>
      <div className={styles.previewBanner}>
        <div>
          <div className={styles.previewTitle}>
            PDF preview — {title || 'Untitled'}
          </div>
          <p className={styles.previewNote}>
            Page view using <strong>Settings → Default deal values</strong>{' '}
            ({pages.length} page{pages.length === 1 ? '' : 's'}). Explicit{' '}
            <strong>Page ↵</strong> breaks start a new sheet; long content
            without breaks is auto-split. Print / Save as PDF uses real printer
            page breaks.
          </p>
        </div>
        <div className={styles.editorActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            ← Back to editor
          </button>
          <button
            type="button"
            className={styles.printBtn}
            onClick={handlePrint}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className={styles.previewDesk}>
        {pages.map((pageHtml, i) => (
          <div key={i} className={styles.previewPage}>
            <div
              className={styles.previewPageInner}
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
            <div className={styles.previewPageNum}>
              {i + 1} / {pages.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
