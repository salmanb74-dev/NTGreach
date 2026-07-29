import type { Config } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'support-files'
const PAGE_SIZE = 1000

function storagePathFromPublicUrl(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(fileUrl.slice(index + marker.length).split('?')[0])
}

async function getReferencedPaths(supabase: ReturnType<typeof createClient>) {
  const paths = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('support_messages')
      .select('file_url')
      .not('file_url', 'is', null)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    for (const row of data ?? []) {
      const path = row.file_url ? storagePathFromPublicUrl(row.file_url) : null
      if (path) paths.add(path)
    }
    if (!data || data.length < PAGE_SIZE) break
  }

  return paths
}

async function removeExpiredVideos(supabase: ReturnType<typeof createClient>) {
  let deleted = 0

  while (true) {
    const { data: rows, error } = await supabase
      .from('support_messages')
      .select('id, file_url')
      .eq('message_type', 'video')
      .not('file_url', 'is', null)
      .lte('expires_at', new Date().toISOString())
      .limit(200)

    if (error) throw error
    if (!rows?.length) break

    let batchDeleted = 0
    for (const row of rows) {
      const path = row.file_url ? storagePathFromPublicUrl(row.file_url) : null
      if (!path) {
        console.error(`Invalid expired video URL for message ${row.id}`)
        continue
      }

      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path])
      if (removeError) {
        console.error(`Failed deleting ${path}: ${removeError.message}`)
        continue
      }

      const { error: updateError } = await supabase
        .from('support_messages')
        .update({ file_url: null, content: null })
        .eq('id', row.id)

      if (updateError) {
        console.error(`Failed clearing message ${row.id}: ${updateError.message}`)
        continue
      }

      deleted++
      batchDeleted++
    }

    // Avoid an infinite loop if every row in this batch failed.
    if (batchDeleted === 0) break
  }

  return deleted
}

/** Remove old image/video objects that no message references (legacy orphans). */
async function removeOrphanedMedia(supabase: ReturnType<typeof createClient>) {
  const referenced = await getReferencedPaths(supabase)
  const cutoff = Date.now() - 60 * 60 * 1000
  let deleted = 0

  for (const root of ['images', 'video']) {
    for (let folderOffset = 0; ; folderOffset += PAGE_SIZE) {
      const { data: folders, error: folderError } = await supabase.storage
        .from(BUCKET)
        .list(root, { limit: PAGE_SIZE, offset: folderOffset })

      if (folderError) throw folderError

      for (const folder of folders ?? []) {
        if (folder.id) continue

        const prefix = `${root}/${folder.name}`
        const orphanPaths: string[] = []

        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data: files, error: fileError } = await supabase.storage
            .from(BUCKET)
            .list(prefix, { limit: PAGE_SIZE, offset })

          if (fileError) throw fileError

          orphanPaths.push(...(files ?? [])
            .filter(file => {
              if (!file.id) return false
              const path = `${prefix}/${file.name}`
              const modifiedAt = new Date(file.updated_at ?? file.created_at ?? 0).getTime()
              return !referenced.has(path) && modifiedAt < cutoff
            })
            .map(file => `${prefix}/${file.name}`))

          if (!files || files.length < PAGE_SIZE) break
        }

        for (let index = 0; index < orphanPaths.length; index += 100) {
          const batch = orphanPaths.slice(index, index + 100)
          const { error: removeError } = await supabase.storage
            .from(BUCKET)
            .remove(batch)
          if (removeError) throw removeError
          deleted += batch.length
        }
      }

      if (!folders || folders.length < PAGE_SIZE) break
    }
  }

  return deleted
}

/** Daily permanent cleanup: expired videos plus orphaned screenshots/videos. */
export default async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing Supabase admin environment variables')
    return
  }

  try {
    const supabase = createClient(url, serviceKey)
    const expired = await removeExpiredVideos(supabase)
    const orphans = await removeOrphanedMedia(supabase)
    console.log(
      `Support media cleanup: expired=${expired} orphaned=${orphans}`
    )
  } catch (err) {
    console.error('Scheduled support media cleanup error:', err)
  }
}

export const config: Config = {
  schedule: '30 5 * * *', // daily 05:30 UTC
}
