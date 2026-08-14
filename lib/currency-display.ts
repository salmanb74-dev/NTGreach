/** value → label map for currency enumerations (case-insensitive lookup). */
export function currencyLabelsFromOptions(
  options: readonly { value: string; label: string }[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { value, label } of options) {
    out[value] = label
    out[value.toUpperCase()] = label
  }
  return out
}

/** e.g. "US Dollar (US$)" → "US$"; uses stored code when label has no "(…)" suffix. */
export function currencySuffixFromLabel(
  label: string,
  fallbackCode: string
): string {
  const match = label.match(/\(([^)]+)\)\s*$/)
  if (match) return match[1].trim()
  return fallbackCode
}

/** Template {{currency}}: bracket suffix from Lists & Values label, else ISO code. */
export function resolveCurrencyDisplay(
  code: string,
  labels?: Record<string, string> | null
): string {
  if (!labels) return code
  const label = labels[code] ?? labels[code.toUpperCase()]
  if (!label) return code
  return currencySuffixFromLabel(label, code)
}
