/**
 * Migration: Move base64 images from Supabase column `mcp_servers.generated_image`
 * to Vercel Blob storage as public files, and update the DB to store the Blob URL.
 *
 * How to run:
 *   1) Ensure `.env.local` has:
 *      - VITE_SUPABASE_URL
 *      - SUPABASE_SERVICE_ROLE_KEY (admin access for script)
 *      - BLOB_READ_WRITE_TOKEN (Vercel Blob RW token)
 *   2) npm run migrate:blob
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { put } from '@vercel/blob'

type ServerRow = {
  id: string
  name: string
  generated_image: string | null
}

// Decode a data URL (data:image/png;base64,...) to a Buffer
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!match) {
    throw new Error('Invalid data URL format for image')
  }
  const contentType = match[1] || 'application/octet-stream'
  const base64 = match[2]
  const buffer = Buffer.from(base64, 'base64')
  return { buffer, contentType }
}

async function main() {
  // Safety checks for required env
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN in environment')
  }

  // Fetch servers that still have base64 images (skip already-migrated URLs)
  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('mcp_servers')
    .select('id, name, generated_image')
    .not('generated_image', 'is', null)

  if (error) throw error

  const candidates: ServerRow[] = (rows || []).filter((r: ServerRow) =>
    typeof r.generated_image === 'string' && r.generated_image.startsWith('data:')
  )

  if (candidates.length === 0) {
    console.log('No base64 images found to migrate. All set!')
    return
  }

  console.log(`Found ${candidates.length} images to migrate...`)

  // Concurrency control
  const concurrency = 3
  let index = 0
  const failures: Array<{ id: string; reason: string }> = []

  async function worker(workerId: number) {
    while (index < candidates.length) {
      const current = candidates[index++]
      const displayName = current.name || current.id
      try {
        if (!current.generated_image) continue
        const { buffer, contentType } = dataUrlToBuffer(current.generated_image)

        // Construct a stable path in Blob storage
        const path = `catastropic/servers/${current.id}.png`

        // Upload to Vercel Blob (public)
        const { url } = await put(path, buffer, {
          access: 'public',
          contentType,
          token: blobToken,
        })

        // Update DB to point to the Blob URL
        const { error: updateErr } = await supabase
          .from('mcp_servers')
          .update({
            generated_image: url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', current.id)

        if (updateErr) throw updateErr
        console.log(`[OK] ${displayName} → ${url}`)
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[FAIL] ${displayName}:`, reason)
        failures.push({ id: current.id, reason })
      }
    }
  }

  // Run workers
  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  console.log('\nMigration finished.')
  console.log(`Successful: ${candidates.length - failures.length}`)
  console.log(`Failed: ${failures.length}`)
  if (failures.length) {
    console.log('Failures:')
    failures.forEach((f) => console.log(` - ${f.id}: ${f.reason}`))
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Migration error:', e)
    process.exit(1)
  })


