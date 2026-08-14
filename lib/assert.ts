/** Throw if a Supabase/Postgrest-style error is present. */
export function assertNoError(
  error: { message: string } | null | undefined,
  fallback = 'Request failed'
): void {
  if (error) throw new Error(error.message || fallback)
}

/** Throw when a write succeeded but RLS or filters matched no rows. */
export function assertRows(
  rows: unknown[] | null | undefined,
  fallback = 'No rows updated — check permissions or try refreshing the page'
): void {
  if (!rows?.length) throw new Error(fallback)
}
