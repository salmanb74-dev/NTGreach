import styles from '../TenantSubscription.module.css'

type Props<T extends Record<string, unknown>> = {
  form: T
  valueKey: keyof T & string
  unlKey: keyof T & string
  patchForm: (p: Partial<T>) => void
}

export default function LimitField<T extends Record<string, unknown>>({
  form,
  valueKey,
  unlKey,
  patchForm,
}: Props<T>) {
  return (
    <div className={styles.limitInner}>
      <input
        className={styles.inputSm}
        type="number"
        min={1}
        step={1}
        disabled={Boolean(form[unlKey])}
        value={String(form[valueKey] ?? '')}
        placeholder="∞"
        onChange={e =>
          patchForm({
            [valueKey]: e.target.value,
            [unlKey]: false,
          } as Partial<T>)
        }
      />
      <label className={styles.checkSm}>
        <input
          type="checkbox"
          checked={Boolean(form[unlKey])}
          onChange={e =>
            patchForm({
              [unlKey]: e.target.checked,
              ...(e.target.checked ? { [valueKey]: '' } : {}),
            } as Partial<T>)
          }
        />
        ∞
      </label>
    </div>
  )
}
