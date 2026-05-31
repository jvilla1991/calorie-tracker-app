import api from './axios'
import type { DiaryResponse, DiaryMeal, DiaryItem } from '../types'

export const getDiary = (date: string) =>
  api.get<DiaryResponse>(`/diary/${date}`).then((r) => r.data)

export const addMeal = (date: string, mealType: string) =>
  api.post<DiaryMeal>(`/diary/${date}/meals`, { mealType }).then((r) => r.data)

export const addItem = (mealId: number, foodId: number, quantityGrams: number) =>
  api.post<DiaryItem>(`/diary/meals/${mealId}/items`, { foodId, quantityGrams }).then((r) => r.data)

export const updateItem = (itemId: number, quantityGrams: number) =>
  api.put<DiaryItem>(`/diary/meals/items/${itemId}`, { quantityGrams }).then((r) => r.data)

export const deleteItem = (itemId: number) =>
  api.delete(`/diary/meals/items/${itemId}`)
