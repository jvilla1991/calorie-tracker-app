import api from './axios'
import type { DailyGoal } from '../types'

export const getGoals = () =>
  api.get<DailyGoal>('/goals').then((r) => r.data)

export const updateGoals = (goals: Omit<DailyGoal, 'id' | 'effectiveFrom'>) =>
  api.put<DailyGoal>('/goals', goals).then((r) => r.data)
