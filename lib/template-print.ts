import { substituteVariables, prefillFromLead } from '@/lib/contracts'
import { prefillQuotationFromLead } from '@/lib/quotations'
import {
  leadFieldsFromDealDefaults,
  TEMPLATE_TABLE,
  type DealQuoteDefaults,
} from '@/lib/subscription-quote'

export type TemplateVarDef = {
  key: string
  label: string
  example: string
}

/** Fill template tokens with each variable’s example value (Settings preview). */
export function sampleVariablesFromDefs(
  defs: readonly TemplateVarDef[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of defs) {
    out[v.key] = v.example
  }
  return out
}

/**
 * Preview fill: Settings → Default deal values for commercial tokens,
 * plus example client/meta fields from the variable catalog.
 */
export function previewVariablesFromDealDefaults(
  defs: readonly TemplateVarDef[],
  defaults: DealQuoteDefaults,
  kind: 'contract' | 'quotation'
): Record<string, string> {
  const examples = sampleVariablesFromDefs(defs)
  const fields = leadFieldsFromDealDefaults(defaults)
  const fakeLead = {
    company_name: examples.client_name || 'Sample Company Ltd',
    contact_name: 'Sample Contact',
    email: examples.client_email || 'sample@example.com',
    address: examples.client_address || '123 Sample Street',
    deal_currency: fields.deal_currency,
    quoted_mrr: fields.quoted_mrr,
    quoted_setup_fee: fields.quoted_setup_fee,
    payment_frequency: fields.payment_frequency,
    quoted_subscription: fields.quoted_subscription,
    discount: null,
    tax_rate: null,
    payment_start_date: null as string | null,
  }

  const fromDeal =
    kind === 'quotation'
      ? prefillQuotationFromLead(fakeLead, defaults.currency)
      : prefillFromLead(fakeLead, defaults.currency)

  return { ...examples, ...fromDeal }
}

export function renderTemplatePreview(
  html: string,
  defs: readonly TemplateVarDef[],
  previewVars?: Record<string, string>
): string {
  const vars = previewVars ?? sampleVariablesFromDefs(defs)
  return substituteVariables(html, vars)
}

/** Split rendered HTML on TipTap page-break nodes. */
export function splitHtmlByPageBreaks(html: string): string[] {
  const re = /<div[^>]*\bdata-type=["']page-break["'][^>]*>[\s\S]*?<\/div>/gi
  const parts = html.split(re).map(p => p.trim())
  const cleaned = parts.filter(p => p.length > 0)
  return cleaned.length > 0 ? cleaned : [html.trim() || '']
}

/**
 * Pack a segment’s top-level blocks into A4-sized HTML chunks (browser only).
 * Used when content has no page breaks but is taller than one page.
 */
export function packHtmlIntoPageChunks(
  segmentHtml: string,
  contentWidthPx: number,
  contentHeightPx: number
): string[] {
  if (typeof document === 'undefined') return [segmentHtml]

  const measure = document.createElement('div')
  measure.style.cssText = `
    position: absolute; left: -99999px; top: 0;
    width: ${contentWidthPx}px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt; line-height: 1.7; color: #1a1a18;
    visibility: hidden; pointer-events: none;
  `
  measure.innerHTML = segmentHtml
  document.body.appendChild(measure)

  const children = Array.from(measure.childNodes)
  if (children.length === 0) {
    document.body.removeChild(measure)
    return [segmentHtml]
  }

  if (measure.scrollHeight <= contentHeightPx + 2) {
    const html = measure.innerHTML
    document.body.removeChild(measure)
    return [html]
  }

  const pages: string[] = []
  let bucket = document.createElement('div')
  bucket.style.cssText = measure.style.cssText

  const flush = () => {
    const html = bucket.innerHTML.trim()
    if (html) pages.push(html)
    bucket = document.createElement('div')
    bucket.style.cssText = measure.style.cssText
  }

  for (const node of children) {
    bucket.appendChild(node.cloneNode(true))
    document.body.appendChild(bucket)
    const overflow = bucket.scrollHeight > contentHeightPx + 2
    document.body.removeChild(bucket)
    if (overflow && bucket.childNodes.length > 1) {
      bucket.removeChild(bucket.lastChild!)
      flush()
      bucket.appendChild(node.cloneNode(true))
    }
  }
  flush()
  document.body.removeChild(measure)

  return pages.length > 0 ? pages : [segmentHtml]
}

/** Shared print / PDF stylesheet (contracts, quotations, Settings preview). */
export const TEMPLATE_PRINT_STYLES = `
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.7;
    color: #1a1a18;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 40px;
  }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 20px; }
  h2 { font-size: 13pt; margin-top: 24px; margin-bottom: 8px; }
  p { margin: 0 0 10px; }
  ul, ol { padding-left: 20px; margin: 0 0 8px; }
  li { margin: 0; padding: 0; line-height: 1.35; }
  li p { margin: 0 !important; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11pt; }
  th, td {
    padding: ${TEMPLATE_TABLE.cellPad} !important;
    vertical-align: middle;
    border: 1px solid ${TEMPLATE_TABLE.border};
    line-height: 1.25;
    font-size: 11pt;
  }
  th { background: ${TEMPLATE_TABLE.headerBg}; font-weight: 600; text-align: left; }
  td p, th p { margin: 0 !important; line-height: 1.25; }
  .page-break {
    display: block;
    height: 0;
    margin: 0;
    padding: 0;
    border: none;
    page-break-after: always;
    break-after: page;
  }
  .page-break-label { display: none; }
  @media print {
    body { margin: 0; max-width: none; padding: 0 24px; }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
  }
`

export function openTemplatePrintWindow(title: string, bodyHtml: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${TEMPLATE_PRINT_STYLES}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`)
  win.document.close()
  win.focus()
  win.print()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
