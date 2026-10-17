import api from './axios'
import type { DiaryResponse, DiaryMeal, DiaryItem, ExerciseEntry, EatingWindow, MealPhoto } from '../types'
import type { ResizedPhoto } from '../utils/imageResize'

const normPhoto = (p: MealPhoto): MealPhoto => ({ id: Number(p.id), thumbUrl: p.thumbUrl, fullUrl: p.fullUrl })

/** A meal as the page uses it — an older API omits the note, estimate and photo fields. */
const normMeal = (m: DiaryMeal): DiaryMeal => ({
  ...m,
  note: m.note ?? null,
  estimatedCalories: m.estimatedCalories == null ? null : Number(m.estimatedCalories) || null,
  photos: (m.photos ?? []).map(normPhoto),
})

export const getDiary = (date: string) =>
  api.get<DiaryResponse>(`/diary/${date}`).then((r): DiaryResponse => {
    // Normalise once here so the page never has to guard against missing fields.
    const exercise = (r.data.exercise ?? []).map((e) => ({ ...e, calories: Number(e.calories) || 0 }))
    return {
      ...r.data,
      meals: (r.data.meals ?? []).map(normMeal),
      exercise,
      exerciseCalories: Number(r.data.exerciseCalories ?? exercise.reduce((s, e) => s + e.calories, 0)) || 0,
      eatingWindow: r.data.eatingWindow ?? null,
    }
  })

/** Logs an activity for the day. name 1–60 chars, calories a whole number 1–5000. */
export const addExercise = (date: string, name: string, calories: number) =>
  api.post<ExerciseEntry>(`/diary/${date}/exercise`, { name, calories }).then((r) => r.data)

export const deleteExercise = (id: number) =>
  api.delete(`/diary/exercise/${id}`)

/**
 * Sets the day's eating window. Send instants with an offset (see toIsoWithOffset);
 * endedAt null keeps the window open. To remove it, use clearEatingWindow.
 */
export const setEatingWindow = (date: string, startedAt: string, endedAt: string | null) =>
  api.put<EatingWindow>(`/diary/${date}/eating-window`, { startedAt, endedAt }).then((r) => r.data)

export const clearEatingWindow = (date: string) =>
  api.delete(`/diary/${date}/eating-window`)

export const addMeal = (date: string, mealType: string) =>
  api.post<DiaryMeal>(`/diary/${date}/meals`, { mealType }).then((r) => normMeal(r.data))

/**
 * Sets a meal's note (≤500 chars) and rough kcal estimate (1–10,000). Both are always
 * sent; null clears that field. The API adds the estimate to the meal and day totals.
 */
export const updateMealDetails = (mealId: number, note: string | null, estimatedCalories: number | null) =>
  api.put<DiaryMeal>(`/diary/meals/${mealId}/details`, { note, estimatedCalories }).then((r) => normMeal(r.data))

/**
 * Adds one photo to a meal (at most 6 per meal — 409 past that). Send what
 * resizeForUpload made: both parts are JPEG (full ≤ 3 MB, thumb ≤ 500 KB).
 * `onProgress` gets the fraction of the request body sent so far (0–1).
 */
export const uploadMealPhoto = (mealId: number, photo: ResizedPhoto, onProgress?: (fraction: number) => void) => {
  const form = new FormData()
  form.append('full', photo.full, 'full.jpg')
  form.append('thumb', photo.thumb, 'thumb.jpg')
  form.append('width', String(photo.width))
  form.append('height', String(photo.height))
  return api
    .post<MealPhoto>(`/diary/meals/${mealId}/photos`, form, {
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.min(1, e.loaded / e.total)) },
    })
    .then((r) => normPhoto(r.data))
}

export const deletePhoto = (photoId: number) =>
  api.delete(`/photos/${photoId}`)

export const addItem = (mealId: number, foodId: number, quantityGrams: number) =>
  api.post<DiaryItem>(`/diary/meals/${mealId}/items`, { foodId, quantityGrams }).then((r) => r.data)

export const updateItem = (itemId: number, quantityGrams: number) =>
  api.put<DiaryItem>(`/diary/meals/items/${itemId}`, { quantityGrams }).then((r) => r.data)

export const deleteItem = (itemId: number) =>
  api.delete(`/diary/meals/items/${itemId}`)
