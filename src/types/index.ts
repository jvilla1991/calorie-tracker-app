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

export interface DiaryResponse {
  date: string
  meals: DiaryMeal[]
  totals: MacroTotals
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

export interface SavedMealItemResponse {
  food: Food
  quantityGrams: number
  macros: MacroTotals
}

export interface RecentFood {
  food: Food
  /** Always in grams — the canonical storage unit. */
  quantityGrams: number
  /** ISO-8601 offset string of the most-recent log entry for this food. */
  addedAt: string
}

export interface SavedMeal {
  id: number
  name: string
  items: SavedMealItemResponse[]
  totals: MacroTotals
}
