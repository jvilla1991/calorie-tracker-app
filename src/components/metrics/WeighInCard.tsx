import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WeightUnit } from '../../utils/weight'
import { parseWeightInput } from '../../utils/weight'

interface Props {
  unit: WeightUnit
  saving: boolean
  serverError: string | null
  /** Called with a validated weight in kg; the page logs it for today. */
  onLog: (weightKg: number) => void
}

/** "Weekly weigh-in" prompt, shown at the top of Metrics when the last one is 7+ days old. */
export default function WeighInCard({ unit, saving, serverError, onLog }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = parseWeightInput(text, unit)
    if ('error' in r) { setError(r.error); return }
    setError(null)
    onLog(r.kg)
  }

  const msg = error ?? serverError

  return (
    <form className="ct-card ct-metric-card ct-weighin-card" onSubmit={submit} noValidate>
      <div className="ct-weighin-head">
        <span className="ct-weighin-label">Weekly weigh-in</span>
        <span className="ct-weighin-due">● DUE</span>
      </div>
      <div className="ct-weighin-row">
        <div className="ct-in-suffix">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="ct-in"
            placeholder={unit === 'lb' ? '178.4' : '80.9'}
            aria-label={`Today's weight in ${unit}`}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null) }}
            aria-invalid={!!error}
            aria-describedby={msg ? 'weighin-card-error' : undefined}
          />
          <span className="ct-in-unit" aria-hidden>{unit}</span>
        </div>
        <button type="submit" className="ct-weighin-log" disabled={saving}>
          {saving ? '…' : 'Log'}
        </button>
      </div>
      {msg && <div className="ct-error-msg ct-weighin-err" id="weighin-card-error" role="alert">{msg}</div>}
    </form>
  )
}
