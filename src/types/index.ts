export interface Food {
  id: number
  barcode: string | null
  name: string
  brand: string | null
  caloriesPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  fiberPer100g: number | null
  /** Grams in one standard serving. When set, the "srv" unit is available when logging. */
  servingSizeG: number | null
  source: string
}

/** Grouped food-search result: the user's own foods and external Open Food Facts matches. */
export interface FoodSearchResult {
  /** Foods the user created (source = "custom"). */
  mine: Food[]
  /** Matches from the external Open Food Facts database. */
  external: Food[]
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface DiaryItem {
  id: number
  food: Food
  quantityGrams: number
  macros: MacroTotals
}

export interface DiaryMeal {
  id: number
  mealType: string
  displayOrder: number
  items: DiaryItem[]
  totals: MacroTotals
}

/** Calories burned by one logged activity. They add back to that day's budget. */
export interface ExerciseEntry {
  id: number
  name: string
  calories: number
}

/** The day's eating window: ISO-8601 instants. endedAt is null while still eating. */
export interface EatingWindow {
  startedAt: string
  endedAt: string | null
}

export interface DiaryResponse {
  date: string
  meals: DiaryMeal[]
  totals: MacroTotals
  /** Activities logged that day (empty when none). */
  exercise: ExerciseEntry[]
  /** Sum of `exercise` calories — added to the goal to give the day's budget. */
  exerciseCalories: number
  /** When eating started / stopped that day; null when nothing was logged. */
  eatingWindow: EatingWindow | null
}

export interface DailyGoal {
  id?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  effectiveFrom?: string
}

export interface RecentFood {
  food: Food
  /** Always in grams — the canonical storage unit. */
  quantityGrams: number
  /** ISO-8601 offset string of the most-recent log entry for this food. */
  addedAt: string
}

/** One day of `/api/diary/summary`: what was eaten and the goal in effect that day. */
export interface DaySummary {
  /** YYYY-MM-DD */
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  goalCalories: number
  /** Calories burned that day; the day's budget is goalCalories + exerciseCalories. */
  exerciseCalories: number
  /** The day's eating window (ISO-8601 instants), when one was logged. */
  eatingStartedAt: string | null
  eatingEndedAt: string | null
}

export interface WeighIn {
  id: number
  /** YYYY-MM-DD — at most one weigh-in per date. */
  date: string
  /** Always stored in kg; convert for display with `formatWeight`. */
  weightKg: number
}
