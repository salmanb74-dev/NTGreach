'use client'

import {
  SUPPORT_CATEGORY_LABELS,
  formatLoggedMinutes,
  type ConversationItem,
  type SupportCategory,
} from './types'
import styles from './ChatWindow.module.css'

type Props = {
  conversation: ConversationItem
  savingMeta: boolean
  onCategoryChange: (category: SupportCategory) => void
  onMinutesChange: (minutes: number) => void
}

export default function ChatMetaBar({
  conversation,
  savingMeta,
  onCategoryChange,
  onMinutesChange,
}: Props) {
  return (
    <div className={styles.metaBar}>
      <label className={styles.metaField}>
        <span className={styles.metaLabel}>Type</span>
        <select
          className={styles.metaSelect}
          value={conversation.support_category}
          disabled={savingMeta}
          onChange={e => onCategoryChange(e.target.value as SupportCategory)}
          aria-label="Support category"
        >
          <option value="platform">{SUPPORT_CATEGORY_LABELS.platform}</option>
          <option value="operational">{SUPPORT_CATEGORY_LABELS.operational}</option>
        </select>
      </label>

      <div className={styles.metaField}>
        <span className={styles.metaLabel}>Logged</span>
        <div className={styles.minutesControl}>
          <button
            type="button"
            className={styles.minutesBtn}
            disabled={savingMeta || conversation.logged_minutes <= 0}
            onClick={() => onMinutesChange(conversation.logged_minutes - 5)}
            aria-label="Decrease minutes by 5"
          >
            −
          </button>
          <span className={styles.minutesValue}>
            {formatLoggedMinutes(conversation.logged_minutes)}
          </span>
          <button
            type="button"
            className={styles.minutesBtn}
            disabled={savingMeta}
            onClick={() => onMinutesChange(conversation.logged_minutes + 5)}
            aria-label="Increase minutes by 5"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
