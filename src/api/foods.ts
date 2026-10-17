import { infiniteQueryOptions } from '@tanstack/react-query'
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

export const RECENT_PAGE_SIZE = 20

/**
 * The recent-foods list as one shared infinite query. The food sheet reads it and the
 * tab layout prefetches it at startup, so "+ Log" opens onto a list that's already there.
 * Key stays ['recent-foods'] so invalidations refresh every loaded page.
 */
export const recentFoodsQuery = infiniteQueryOptions({
  queryKey: ['recent-foods'],
  queryFn: ({ pageParam }) => getRecentFoods(pageParam, RECENT_PAGE_SIZE),
  initialPageParam: 0,
  getNextPageParam: (lastPage: RecentFood[], _allPages: RecentFood[][], lastPageParam: number) =>
    lastPage.length < RECENT_PAGE_SIZE ? undefined : lastPageParam + 1,
  staleTime: 30_000,
  // Kept even while no sheet is open, so a later "+ Log" doesn't start from empty.
  gcTime: Infinity,
})
