/**
 * Safe {{= expression}} formulas + {{#if}} blocks for contract / quotation templates.
 * Supports + - * /, comparisons, parentheses, identifiers, round(), if().
 * No eval / Function — recursive-descent only.
 */

/** Tokens treated as blank / non-numeric in templates & formulas. */
export const TEMPLATE_BLANK_TOKENS =
  /^(no|n\/a|yes|unlimited|monthly|annual|—|–|-)$/i

export function parseTemplateNumber(raw: string | null | undefined): number {
  if (raw == null) return 0
  const t = String(raw).trim()
  if (!t) return 0
  if (TEMPLATE_BLANK_TOKENS.test(t)) return 0

  const cleaned = t
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .replace(/^[A-Z]{3}\s+/i, '')
    .replace(/%\s*$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim()

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function numericContextFromVariables(
  variables: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(variables)) {
    out[key] = parseTemplateNumber(value)
  }
  return out
}

export function formatFormulaResult(n: number): string {
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

type CmpOp = '==' | '!=' | '<=' | '>=' | '<' | '>'
type ArithOp = '+' | '-' | '*' | '/'

type Tok =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: ArithOp }
  | { kind: 'cmp'; op: CmpOp }
  | { kind: 'lp' }
  | { kind: 'rp' }
  | { kind: 'comma' }

function tokenize(expr: string): Tok[] {
  const tokens: Tok[] = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ kind: 'lp' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ kind: 'rp' })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ kind: 'comma' })
      i++
      continue
    }
    // Two-char comparisons first
    const two = expr.slice(i, i + 2)
    if (
      two === '==' ||
      two === '!=' ||
      two === '<=' ||
      two === '>='
    ) {
      tokens.push({ kind: 'cmp', op: two })
      i += 2
      continue
    }
    if (c === '<' || c === '>') {
      tokens.push({ kind: 'cmp', op: c })
      i++
      continue
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ kind: 'op', op: c })
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++
      const raw = expr.slice(i, j)
      const n = Number(raw)
      if (!Number.isFinite(n)) throw new Error(`Invalid number "${raw}"`)
      tokens.push({ kind: 'num', value: n })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++
      tokens.push({ kind: 'id', name: expr.slice(i, j) })
      i = j
      continue
    }
    throw new Error(`Unexpected character "${c}"`)
  }
  return tokens
}

function cmp(op: CmpOp, left: number, right: number): number {
  switch (op) {
    case '==':
      return left === right ? 1 : 0
    case '!=':
      return left !== right ? 1 : 0
    case '<':
      return left < right ? 1 : 0
    case '>':
      return left > right ? 1 : 0
    case '<=':
      return left <= right ? 1 : 0
    case '>=':
      return left >= right ? 1 : 0
  }
}

class Parser {
  private i = 0
  constructor(
    private tokens: Tok[],
    private vars: Record<string, number>
  ) {}

  private peek(): Tok | undefined {
    return this.tokens[this.i]
  }

  private take(): Tok {
    const t = this.tokens[this.i++]
    if (!t) throw new Error('Unexpected end of formula')
    return t
  }

  parse(): number {
    const value = this.parseComparison()
    if (this.peek()) throw new Error('Unexpected trailing tokens')
    return value
  }

  /** Public for multi-arg function parsing (stops before comma / ')'). */
  parseComparison(): number {
    let left = this.parseAdd()
    const t = this.peek()
    if (t?.kind === 'cmp') {
      this.take()
      const right = this.parseAdd()
      left = cmp(t.op, left, right)
    }
    return left
  }

  private parseAdd(): number {
    let left = this.parseMul()
    while (this.peek()?.kind === 'op') {
      const op = (this.peek() as Extract<Tok, { kind: 'op' }>).op
      if (op !== '+' && op !== '-') break
      this.take()
      const right = this.parseMul()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  private parseMul(): number {
    let left = this.parseUnary()
    while (this.peek()?.kind === 'op') {
      const op = (this.peek() as Extract<Tok, { kind: 'op' }>).op
      if (op !== '*' && op !== '/') break
      this.take()
      const right = this.parseUnary()
      if (op === '/') {
        if (right === 0) throw new Error('Division by zero')
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  private parseUnary(): number {
    if (this.peek()?.kind === 'op') {
      const op = (this.peek() as Extract<Tok, { kind: 'op' }>).op
      if (op === '+' || op === '-') {
        this.take()
        const v = this.parseUnary()
        return op === '-' ? -v : v
      }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    const t = this.peek()
    if (!t) throw new Error('Unexpected end of formula')

    if (t.kind === 'num') {
      this.take()
      return t.value
    }

    if (t.kind === 'id') {
      this.take()
      if (this.peek()?.kind === 'lp') {
        return this.parseCall(t.name)
      }
      return this.vars[t.name] ?? 0
    }

    if (t.kind === 'lp') {
      this.take()
      const v = this.parseComparison()
      const close = this.take()
      if (close.kind !== 'rp') throw new Error('Expected ")"')
      return v
    }

    throw new Error('Expected number, variable, or "("')
  }

  private parseCall(name: string): number {
    const open = this.take()
    if (open.kind !== 'lp') throw new Error('Expected "("')

    const fn = name.toLowerCase()

    if (fn === 'round') {
      const value = this.parseComparison()
      let digits = 0
      if (this.peek()?.kind === 'comma') {
        this.take()
        digits = this.parseComparison()
      }
      const close = this.take()
      if (close.kind !== 'rp') throw new Error('Expected ")"')
      const d = Math.max(0, Math.min(8, Math.round(digits)))
      const f = 10 ** d
      return Math.round(value * f) / f
    }

    if (fn === 'if') {
      const cond = this.parseComparison()
      if (this.take().kind !== 'comma') throw new Error('if() needs 3 arguments')
      const thenV = this.parseComparison()
      if (this.take().kind !== 'comma') throw new Error('if() needs 3 arguments')
      const elseV = this.parseComparison()
      const close = this.take()
      if (close.kind !== 'rp') throw new Error('Expected ")"')
      return cond !== 0 ? thenV : elseV
    }

    throw new Error(`Unknown function "${name}"`)
  }
}

export function evaluateTemplateFormula(
  expr: string,
  vars: Record<string, number>
): { ok: true; value: number } | { ok: false; error: string } {
  try {
    const tokens = tokenize(expr.trim())
    if (tokens.length === 0) throw new Error('Empty formula')
    const value = new Parser(tokens, vars).parse()
    if (!Number.isFinite(value)) throw new Error('Non-finite result')
    return { ok: true, value }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid formula',
    }
  }
}

/** True when formula/condition resolves to a non-zero number. */
export function isTemplateConditionTruthy(
  expr: string,
  vars: Record<string, number>
): boolean {
  const result = evaluateTemplateFormula(expr, vars)
  return result.ok && result.value !== 0
}

const FORMULA_RE = /\{\{=\s*([^}]+?)\s*\}\}/g
const IF_OPEN_RE = /\{\{#if\s+([^}]+)\}\}/g
const IF_CLOSE = '{{/if}}'
const IF_ELSE = '{{else}}'

/**
 * Expand {{#if expr}}…{{else}}…{{/if}} (innermost first).
 * Blank / null / 0 variables are falsy; use `fee > 0` for an explicit check.
 */
export function substituteTemplateConditionals(
  content: string,
  variables: Record<string, string>
): string {
  const nums = numericContextFromVariables(variables)
  let result = content
  for (let guard = 0; guard < 200; guard++) {
    const closeIdx = result.indexOf(IF_CLOSE)
    if (closeIdx === -1) break

    const before = result.slice(0, closeIdx)
    const opens = [...before.matchAll(IF_OPEN_RE)]
    const openMatch = opens[opens.length - 1]
    if (!openMatch || openMatch.index == null) {
      // Orphan {{/if}} — drop it
      result =
        result.slice(0, closeIdx) + result.slice(closeIdx + IF_CLOSE.length)
      continue
    }

    const openStart = openMatch.index
    const openEnd = openStart + openMatch[0].length
    const condExpr = openMatch[1].trim()
    const inner = result.slice(openEnd, closeIdx)
    const elseIdx = inner.indexOf(IF_ELSE)
    const thenPart = elseIdx === -1 ? inner : inner.slice(0, elseIdx)
    const elsePart =
      elseIdx === -1 ? '' : inner.slice(elseIdx + IF_ELSE.length)

    const keep = isTemplateConditionTruthy(condExpr, nums)
    const replacement = keep ? thenPart : elsePart
    result =
      result.slice(0, openStart) +
      replacement +
      result.slice(closeIdx + IF_CLOSE.length)
  }
  return result
}

/** Replace {{= expr}} tokens; leave failures highlighted. */
export function substituteTemplateFormulas(
  content: string,
  variables: Record<string, string>
): string {
  const nums = numericContextFromVariables(variables)
  return content.replace(FORMULA_RE, (_full, expr: string) => {
    const result = evaluateTemplateFormula(expr, nums)
    if (!result.ok) {
      return `<span style="background:#fee2e2;color:#991b1b;padding:1px 4px;border-radius:3px;" title="${escapeAttr(result.error)}">{{= ${expr.trim()}}}</span>`
    }
    return formatFormulaResult(result.value)
  })
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
