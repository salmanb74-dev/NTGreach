/** Throw if a Supabase/Postgrest-style error is present. */
export function assertNoError(
  error: { message: string } | null | undefined,
  fallback = 'Request failed'
): void {
  if (error) throw new Error(error.message || fallback)
}
