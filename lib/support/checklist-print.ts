import {
  listTypeLabel,
  statusLabel,
  type ChecklistLine,
  type ChecklistListType,
  type ChecklistRestaurant,
} from '@/lib/support/checklists'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font: 12pt/1.45 Georgia, "Times New Roman", serif;
    color: #111;
    background: #fff;
  }
  .title {
    margin: 0 0 14px;
    font-size: 14pt;
    font-weight: 700;
  }
  .fill-in {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 28px;
    margin: 0 0 18px;
    font-size: 10.5pt;
  }
  .fill-in span {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    min-width: 180px;
  }
  .fill-in .line {
    display: inline-block;
    min-width: 140px;
    border-bottom: 1px solid #111;
    height: 1.1em;
  }
  .fill-in .line.wide {
    min-width: 260px;
  }
  .notes {
    margin: 0 0 18px;
    padding: 8px 10px;
    border: 1px solid #ccc;
    font-size: 10pt;
  }
  h2 {
    margin: 20px 0 8px;
    font-size: 12pt;
    font-weight: 700;
    border-bottom: 1px solid #111;
    padding-bottom: 4px;
  }
  .section + .section {
    break-before: page;
    page-break-before: always;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    text-align: left;
    vertical-align: top;
    padding: 6px 4px;
    border-bottom: 1px solid #ddd;
    font-size: 10.5pt;
  }
  th {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #555;
    border-bottom: 1px solid #999;
  }
  .status {
    width: 22%;
    white-space: nowrap;
  }
  .mark {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1.5px solid #111;
    margin-right: 6px;
    vertical-align: -1px;
  }
  .mark.done { background: #111; }
  .mark.skip {
    background:
      linear-gradient(to top left, transparent calc(50% - 0.75px), #111 calc(50% - 0.75px), #111 calc(50% + 0.75px), transparent calc(50% + 0.75px)),
      linear-gradient(to top right, transparent calc(50% - 0.75px), #111 calc(50% - 0.75px), #111 calc(50% + 0.75px), transparent calc(50% + 0.75px));
  }
  .footer {
    margin-top: 28px;
    font-size: 9pt;
    color: #666;
  }
  @media print {
    body { padding: 12mm; }
    a { color: inherit; text-decoration: none; }
  }
`

function sectionHtml(listType: ChecklistListType, lines: ChecklistLine[]): string {
  const rows = lines
    .filter(l => l.list_type === listType)
    .map(line => {
      const markClass =
        line.status === 'done' ? 'done' : line.status === 'not_required' ? 'skip' : ''
      return `<tr>
        <td><span class="mark ${markClass}"></span>${escapeHtml(line.label)}</td>
        <td class="status">${escapeHtml(statusLabel(line.status))}</td>
      </tr>`
    })
    .join('')

  if (!rows) return ''

  return `
    <section class="section">
      <h2>${escapeHtml(listTypeLabel(listType))}</h2>
      <table>
        <thead>
          <tr><th>Item</th><th class="status">Status</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `
}

export function openChecklistPrintWindow(
  restaurant: ChecklistRestaurant,
  lines: ChecklistLine[]
) {
  const win = window.open('', '_blank')
  if (!win) return

  const notesBlock = restaurant.notes?.trim()
    ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(restaurant.notes.trim())}</div>`
    : ''

  const body = `
    <p class="title">Resto onboarding &amp; training checklist</p>
    <div class="fill-in">
      <span>Restaurant <i class="line wide"></i></span>
      <span>Name <i class="line"></i></span>
      <span>Date <i class="line"></i></span>
      <span>Time <i class="line"></i></span>
    </div>
    ${notesBlock}
    ${sectionHtml('onboarding', lines)}
    ${sectionHtml('training', lines)}
    <p class="footer">NTG Resto</p>
  `

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Resto checklist</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>${body}</body>
</html>`)
  win.document.close()

  let printed = false
  const runPrint = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } catch {
      /* ignore */
    }
  }
  setTimeout(runPrint, 200)
}
