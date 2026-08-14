import {
  substituteTemplateConditionals,
  substituteTemplateFormulas,
  TEMPLATE_BLANK_TOKENS,
} from '@/lib/template-formula'

export function substituteTemplateHtml(
  content: string,
  variables: Record<string, string>
): string {
  // Conditionals first so false branches never render.
  let result = substituteTemplateConditionals(content, variables)
  result = substituteTemplateFormulas(result, variables)
  for (const [key, value] of Object.entries(variables)) {
    // Keep intentional blanks (disabled add-ons) so rows can be stripped.
    result = result.replaceAll(`{{${key}}}`, value ?? '')
  }
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">{{$1}}</span>'
  )
  return stripEmptyQuoteTableRows(result)
}

function cellPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Values we treat as “not opted / not applicable” for quote table rows. */
export function isOmittedQuoteValue(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (TEMPLATE_BLANK_TOKENS.test(t) && !/^yes$/i.test(t)) return true
  if (/^0+(\.0+)?$/.test(t)) return true
  // USD 0 / $0 / USD 0 (note)
  if (/^([A-Z]{3}\s*)?\$?\s*0+(\.0+)?(\s*\([^)]*\))?$/i.test(t)) return true
  // leftover currency after empty amount: "USD" / "USD ()"
  if (/^[A-Z]{3}(\s*\(\s*\))?$/i.test(t)) return true
  return false
}

/**
 * Drop body `<tr>` rows whose last `<td>` is blank, "No", or zero.
 * Header rows (`<th>`) are kept.
 */
export function stripEmptyQuoteTableRows(html: string): string {
  return html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, tr => {
    if (/<th\b/i.test(tr)) return tr
    const tds = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    if (tds.length < 2) return tr
    const valueText = cellPlainText(tds[tds.length - 1][1])
    if (isOmittedQuoteValue(valueText)) return ''
    return tr
  })
}
