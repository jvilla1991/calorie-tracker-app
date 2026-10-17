import api from './axios'
import type { DiaryResponse, DiaryMeal, DiaryItem, ExerciseEntry } from '../types'

export const getDiary = (date: string) =>
  api.get<DiaryResponse>(`/diary/${date}`).then((r): DiaryResponse => {
    // Normalise once here so the page never has to guard against missing fields.
    const exercise = (r.data.exercise ?? []).map((e) => ({ ...e, calories: Number(e.calories) || 0 }))
    return {
      ...r.data,
      exercise,
      exerciseCalories: Number(r.data.exerciseCalories ?? exercise.reduce((s, e) => s + e.calories, 0)) || 0,
    }
  })

/** Logs an activity for the day. name 1–60 chars, calories a whole number 1–5000. */
export const addExercise = (date: string, name: string, calories: number) =>
  api.post<ExerciseEntry>(`/diary/${date}/exercise`, { name, calories }).then((r) => r.data)

export const deleteExercise = (id: number) =>
  api.delete(`/diary/exercise/${id}`)

export const addMeal = (date: string, mealType: string) =>
  api.post<DiaryMeal>(`/diary/${date}/meals`, { mealType }).then((r) => r.data)

export const addItem = (mealId: number, foodId: number, quantityGrams: number) =>
  api.post<DiaryItem>(`/diary/meals/${mealId}/items`, { foodId, quantityGrams }).then((r) => r.data)

export const updateItem = (itemId: number, quantityGrams: number) =>
  api.put<DiaryItem>(`/diary/meals/items/${itemId}`, { quantityGrams }).then((r) => r.data)

export const deleteItem = (itemId: number) =>
  api.delete(`/diary/meals/items/${itemId}`)
