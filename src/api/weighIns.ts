import api from './axios'
import type { WeighIn } from '../types'

/** Weigh-ins ascending by date. Both bounds are optional and inclusive (YYYY-MM-DD). */
export const getWeighIns = (from?: string, to?: string) =>
  api
    .get<WeighIn[]>('/weigh-ins', { params: { from, to } })
    .then((r) => r.data.map((w) => ({ ...w, weightKg: Number(w.weightKg) })))

/** Upserts by date: logging a second weigh-in for the same day replaces the first. */
export const logWeighIn = (date: string, weightKg: number) =>
  api.post<WeighIn>('/weigh-ins', { date, weightKg }).then((r) => r.data)

export const deleteWeighIn = (id: number) =>
  api.delete(`/weigh-ins/${id}`)
