import { useQuery } from '@tanstack/react-query'
import { getWeighIns } from '../api/weighIns'
import { mondayOf } from '../utils/date'
import { useAuth } from './useAuth'
import { useToday } from './useToday'

/**
 * Weigh-ins are weekly, on Mondays: one is due from Monday until something is logged
 * dated this week (Monday → today). Always false signed out — weight is private.
 * `hiddenId` leaves out a weigh-in waiting in the undo window, as if already deleted.
 */
export function useWeighInDue(hiddenId: number | null = null): boolean {
  const { loggedIn } = useAuth()
  const today = useToday()
  const monday = mondayOf(today)
  const week = useQuery({
    // Under ['weigh-ins'], so logging or deleting one refreshes this too.
    queryKey: ['weigh-ins', monday, today],
    queryFn: () => getWeighIns(monday, today),
    enabled: loggedIn,
  })
  return loggedIn && week.isSuccess && !week.data.some((w) => w.id !== hiddenId)
}
