import api from './axios'
import type { Food, FoodSearchResult, RecentFood } from '../types'

export const searchFoods = (q: string) =>
  api.get<FoodSearchResult>('/foods/search', { params: { q } }).then((r) => r.data)

export const lookupBarcode = (barcode: string) =>
  api.get<Food>(`/foods/barcode/${barcode}`).then((r) => r.data)

export const createFood = (body: Omit<Food, 'id' | 'source'>) =>
  api.post<Food>('/foods', body).then((r) => r.data)

/**
 * One page of the distinct foods you've logged, most-recent first, each with its
 * last-used quantity. Pages are 0-based; `size` is capped at 50 by the API.
 * A page shorter than `size` means there are no more pages.
 */
export const getRecentFoods = (page: number, size = 20) =>
  api.get<RecentFood[]>('/foods/recent', { params: { page, size } }).then((r) => r.data)
