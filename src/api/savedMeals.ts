import api from './axios'
import type { SavedMeal } from '../types'

export const getSavedMeals = () =>
  api.get<SavedMeal[]>('/saved-meals').then((r) => r.data)

export const createSavedMeal = (name: string, items: { foodId: number; quantityGrams: number }[]) =>
  api.post<SavedMeal>('/saved-meals', { name, items }).then((r) => r.data)

export const addSavedMealToDiary = (id: number, date: string, mealType: string) =>
  api.post(`/saved-meals/${id}/add-to-diary`, null, { params: { date, mealType } })

export const deleteSavedMeal = (id: number) =>
  api.delete(`/saved-meals/${id}`)
