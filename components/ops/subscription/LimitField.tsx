import type { FormState } from './offer-form'
import styles from '../TenantSubscription.module.css'

type LimitKey = 'locations' | 'users' | 'counters' | 'ordersPerMonth'
type UnlKey =
  | 'locationsUnlimited'
  | 'usersUnlimited'
  | 'countersUnlimited'
  | 'ordersUnlimited'

type Props = {
  form: FormState
  valueKey: LimitKey
  unlKey: UnlKey
  patchForm: (p: Partial<FormState>) => void
}

export default function LimitField({ form, valueKey, unlKey, patchForm }: Props) {
  return (
    <div className={styles.limitInner}>
      <input
        className={styles.inputSm}
        type="number"
        min={1}
        step={1}
        disabled={form[unlKey]}
        value={form[valueKey]}
        placeholder="∞"
        onChange={e =>
          patchForm({
            [valueKey]: e.target.value,
            [unlKey]: false,
          } as Partial<FormState>)
        }
      />
      <label className={styles.checkSm}>
        <input
          type="checkbox"
          checked={form[unlKey]}
          onChange={e =>
            patchForm({
              [unlKey]: e.target.checked,
              ...(e.target.checked ? { [valueKey]: '' } : {}),
            } as Partial<FormState>)
          }
        />
        ∞
      </label>
    </div>
  )
}
