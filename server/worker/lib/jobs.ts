import { adminSupabase } from './supabase'
import type { JobStatus, OutputType, DbJob } from '../../../app/types/database.types'

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extras: {
    error_message?: string
    output_summary?: Record<string, unknown>
    started_at?: string
    completed_at?: string
    retry_count?: number
  } = {},
) {
  const { error } = await adminSupabase
    .from('jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extras })
    .eq('id', jobId)

  if (error) console.error(`[jobs] Failed to update job ${jobId} status to ${status}:`, error.message)
}

export async function storeTextOutput(
  job: DbJob,
  content: string,
  label: string,
): Promise<string> {
  const { data, error } = await adminSupabase
    .from('job_outputs')
    .insert({
      job_id: job.id,
      project_id: job.project_id,
      type: 'text' satisfies OutputType,
      label,
      metadata: { content },
    })
    .select('id')
    .single()

  if (error) throw new Error(`storeTextOutput failed: ${error.message}`)
  return data.id
}

export async function storeFileOutput(
  job: DbJob,
  fileBuffer: Buffer,
  storagePath: string,
  type: OutputType,
  label: string,
  mimeType: string,
  metadata?: Record<string, unknown>,
): Promise<{ outputId: string; storagePath: string }> {
  // Upload to Supabase Storage bucket "assets"
  const { error: uploadError } = await adminSupabase.storage
    .from('assets')
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true })

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data, error } = await adminSupabase
    .from('job_outputs')
    .insert({
      job_id: job.id,
      project_id: job.project_id,
      type,
      label,
      storage_url: null,
      storage_path: storagePath,
      mime_type: mimeType,
      ...(metadata ? { metadata } : {}),
    })
    .select('id')
    .single()

  if (error) throw new Error(`storeFileOutput record failed: ${error.message}`)
  return { outputId: data.id, storagePath }
}
