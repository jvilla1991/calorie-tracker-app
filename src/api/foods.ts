import api from './axios'
import type { Food, RecentFood } from '../types'

export const searchFoods = (q: string) =>
  api.get<Food[]>('/foods/search', { params: { q } }).then((r) => r.data)

export const lookupBarcode = (barcode: string) =>
  api.get<Food>(`/foods/barcode/${barcode}`).then((r) => r.data)

export const createFood = (body: Omit<Food, 'id' | 'source'>) =>
  api.post<Food>('/foods', body).then((r) => r.data)

/** Last 10 distinct foods logged, most-recent first, each with its last-used quantity. */
export const getRecentFoods = () =>
  api.get<RecentFood[]>('/foods/recent').then((r) => r.data)
