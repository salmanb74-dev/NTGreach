import styles from '../TenantSubscription.module.css'

type Props = {
  label: string
  newCell: React.ReactNode
  currentCell: React.ReactNode
  /** Highlight when New differs from Current */
  diff?: boolean
}

export default function CompareRow({ label, newCell, currentCell, diff }: Props) {
  const nameCls = diff
    ? `${styles.colName} ${styles.colNameDiff}`
    : styles.colName
  const newCls = diff ? `${styles.colNew} ${styles.colNewDiff}` : styles.colNew
  const curCls = diff ? `${styles.colCur} ${styles.colCurDiff}` : styles.colCur
  return (
    <>
      <div className={nameCls}>{label}</div>
      <div className={newCls}>{newCell}</div>
      <div className={curCls}>{currentCell}</div>
    </>
  )
}
