export type WeeklyLeadDatum = { week: string; count: number }

/** Monday 00:00 local for the week containing `date`. */
function weekStartMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Last N weeks (Mon–Sun buckets), oldest first, including zero-count weeks. */
export function buildWeeklyLeadData(
  leads: { created_at: string }[] | null | undefined,
  weeks = 16
): WeeklyLeadDatum[] {
  const thisMonday = weekStartMonday(new Date())
  const buckets: WeeklyLeadDatum[] = []
  const countByWeek = new Map<number, number>()

  for (let i = weeks - 1; i >= 0; i--) {
    const mon = new Date(thisMonday)
    mon.setDate(thisMonday.getDate() - i * 7)
    countByWeek.set(mon.getTime(), 0)
    buckets.push({
      week: mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      count: 0,
    })
  }

  const mondayTimes = [...countByWeek.keys()].sort((a, b) => a - b)

  for (const lead of leads ?? []) {
    const t = weekStartMonday(new Date(lead.created_at)).getTime()
    if (countByWeek.has(t)) {
      countByWeek.set(t, (countByWeek.get(t) ?? 0) + 1)
    }
  }

  return mondayTimes.map((t, i) => ({
    week: buckets[i]?.week ?? '',
    count: countByWeek.get(t) ?? 0,
  }))
}
