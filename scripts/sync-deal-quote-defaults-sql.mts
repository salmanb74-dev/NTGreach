/**
 * Emit deal_quote_defaults JSON from lib/subscription-quote.ts (STARTER_* constants).
 * Run: npm run sync:deal-defaults-sql
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DEAL_QUOTE_DEFAULTS_JSON,
  STARTER_SETUP_FEE,
} from '../lib/subscription-quote.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const json = DEAL_QUOTE_DEFAULTS_JSON

const sqlFiles = [
  'supabase/deal_quote_defaults_seed.sql',
  'supabase/reset_leads_deal_to_defaults.sql',
  'supabase/subscription_quote_migration.sql',
]

const jsonPattern =
  /('deal_quote_defaults',\s*\n\s*)'(\{.*?\})'/s

for (const rel of sqlFiles) {
  const filePath = path.join(root, rel)
  let text = fs.readFileSync(filePath, 'utf8')
  if (!jsonPattern.test(text)) {
    console.warn(`Skip ${rel}: deal_quote_defaults JSON block not found`)
    continue
  }
  text = text.replace(jsonPattern, `$1'${json}'`)
  fs.writeFileSync(filePath, text, 'utf8')
  console.log(`Updated ${rel}`)
}

// reset_leads_deal_to_defaults.sql fallback setup fee
const resetPath = path.join(root, 'supabase/reset_leads_deal_to_defaults.sql')
let resetSql = fs.readFileSync(resetPath, 'utf8')
resetSql = resetSql.replace(
  /coalesce\(\(subscription->>'setupFee'\)::numeric,\s*\d+\)/g,
  `coalesce((subscription->>'setupFee')::numeric, ${STARTER_SETUP_FEE})`
)
fs.writeFileSync(resetPath, resetSql, 'utf8')
console.log('Updated reset_leads_deal_to_defaults.sql setup fee fallback')
console.log('\nJSON:', json)
