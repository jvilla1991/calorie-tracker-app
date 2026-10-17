import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { uploadMealPhoto } from '../api/diary'
import { PhotoError, resizeForUpload } from '../utils/imageResize'
import { MAX_PHOTOS } from '../utils/photos'
import type { MealPhoto } from '../types'

/** One photo on its way up, shown as a placeholder tile in its meal's strip. */
export interface PhotoUpload {
  key: number
  date: string
  mealType: string
  stage: 'waiting' | 'preparing' | 'uploading'
  /** Share of the request sent (0–1) while uploading. */
  progress: number
  /** Object URL of the shrunk thumbnail once it exists. */
  preview: string | null
}

type Job = { key: number; date: string; mealType: string; file: File }

interface Options {
  /** The meal's row id, creating the row first if the meal has none yet. */
  ensureMealId: (date: string, mealType: string) => Promise<number>
  onUploaded: (date: string, mealId: number, photo: MealPhoto) => void
  /** A user-facing reason a photo didn't make it. */
  onFailed: (message: string) => void
}

function failureText(err: unknown): string {
  if (err instanceof PhotoError) return err.message
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 409) return `That meal already has ${MAX_PHOTOS} photos.`
    if (status === 413) return 'That photo is too large to upload.'
    if (status === 400) {
      const msg = (err.response?.data as { message?: unknown } | undefined)?.message
      return typeof msg === 'string' && msg ? msg : 'That photo couldn’t be uploaded.'
    }
  }
  return 'Photo upload failed — check your connection and try again.'
}

/**
 * Uploads meal photos one at a time, in the order they were picked: shrink on the
 * phone, create the meal row if needed, then send. `uploads` lists the photos still
 * in the queue so the page can show a placeholder tile for each.
 */
export function usePhotoUploads({ ensureMealId, onUploaded, onFailed }: Options) {
  const [uploads, setUploads] = useState<PhotoUpload[]>([])
  const queue = useRef<Job[]>([])
  const running = useRef(false)
  const nextKey = useRef(1)
  // The loop outlives renders; it always calls the latest callbacks.
  const callbacks = useRef({ ensureMealId, onUploaded, onFailed })
  useEffect(() => { callbacks.current = { ensureMealId, onUploaded, onFailed } })

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    const patch = (key: number, p: Partial<PhotoUpload>) =>
      setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)))
    const remove = (keys: number[]) =>
      setUploads((list) => list.filter((u) => !keys.includes(u.key)))
    while (queue.current.length > 0) {
      const job = queue.current[0]
      let preview: string | null = null
      try {
        patch(job.key, { stage: 'preparing' })
        // Shrink first: a photo that can't be decoded never creates an empty meal row.
        const photo = await resizeForUpload(job.file)
        preview = URL.createObjectURL(photo.thumb)
        patch(job.key, { stage: 'uploading', preview, progress: 0 })
        const mealId = await callbacks.current.ensureMealId(job.date, job.mealType)
        const saved = await uploadMealPhoto(mealId, photo, (f) => patch(job.key, { progress: f }))
        callbacks.current.onUploaded(job.date, mealId, saved)
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 409) {
          // The meal is full (e.g. photos added on another device): drop its other queued photos.
          const rest = queue.current.filter((j) => j !== job && j.date === job.date && j.mealType === job.mealType)
          queue.current = queue.current.filter((j) => !rest.includes(j))
          remove(rest.map((j) => j.key))
        }
        callbacks.current.onFailed(failureText(err))
      } finally {
        queue.current = queue.current.filter((j) => j !== job)
        remove([job.key])
        if (preview) URL.revokeObjectURL(preview)
      }
    }
    running.current = false
  }, [])

  /** Queues photos for one meal. The caller has already capped them to the free slots. */
  const enqueue = useCallback((date: string, mealType: string, files: File[]) => {
    if (files.length === 0) return
    const jobs = files.map((file) => ({ key: nextKey.current++, date, mealType, file }))
    queue.current.push(...jobs)
    setUploads((list) => [
      ...list,
      ...jobs.map((j): PhotoUpload => ({ key: j.key, date, mealType, stage: 'waiting', progress: 0, preview: null })),
    ])
    void run()
  }, [run])

  return { uploads, enqueue }
}
