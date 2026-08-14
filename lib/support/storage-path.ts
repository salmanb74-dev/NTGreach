/** Supabase storage bucket for support chat attachments. */
export const SUPPORT_FILES_BUCKET = 'support-files'

/** Extract storage object path from a public bucket URL. */
export function storagePathFromPublicUrl(
  fileUrl: string,
  bucket: string = SUPPORT_FILES_BUCKET
): string | null {
  const marker = `/object/public/${bucket}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(fileUrl.slice(index + marker.length).split('?')[0])
}
