/** Today's date as YYYY-MM-DD — the format used in `/diary/:date` URLs. */
export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
