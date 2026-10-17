import { shortDate } from './date'

/** Photos a meal can hold — the API refuses a 7th with 409. */
export const MAX_PHOTOS = 6

/** Alt text for a meal photo, e.g. "Photo 2 of 4, Lunch Oct 17". */
export const photoAlt = (index: number, count: number, mealLabel: string, date: string) =>
  `Photo ${index + 1} of ${count}, ${mealLabel} ${shortDate(date)}`
