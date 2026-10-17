import api from './axios'
import type { DaySummary } from '../types'

/**
 * One row per day from `from` to `to` inclusive (YYYY-MM-DD), ascending. Days with
 * nothing logged come back as zeros. The API caps the range at 366 days.
 */
export const getSummary = (from: string, to: string) =>
  api
    .get<DaySummary[]>('/diary/summary', { params: { from, to } })
    // Numbers can arrive as decimals (or strings from some serializers) — normalise once here.
    .then((r) =>
      r.data.map((d) => ({
        date: d.date,
        calories: Number(d.calories) || 0,
        protein: Number(d.protein) || 0,
        carbs: Number(d.carbs) || 0,
        fat: Number(d.fat) || 0,
        fiber: Number(d.fiber) || 0,
        goalCalories: Number(d.goalCalories) || 0,
        exerciseCalories: Number(d.exerciseCalories) || 0,
        eatingStartedAt: d.eatingStartedAt ?? null,
        eatingEndedAt: d.eatingEndedAt ?? null,
      }))
    )
