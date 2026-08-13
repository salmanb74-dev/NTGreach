'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  deleteReachUser,
  resetReachUserPassword,
  updateReachUser,
} from '@/lib/actions/platform-users'
import ModuleRoleMatrix from '@/components/platform/ModuleRoleMatrix'
import ConfirmModal from '@/components/modals/ConfirmModal'
import { DEFAULT_TEMP_PASSWORD } from '@/lib/platform/constants'
import {
  selectionFromProfile,
  type ModuleRoleMap,
} from '@/lib/platform/access-model'
import type { PlatformUserRow } from '@/components/platform/types'
import { formatWhen } from '@/lib/format-when'
import styles from './Users.module.css'

type ConfirmAction = 'reset-password' | 'delete-user'

interface Props {
  user: PlatformUserRow
  canEdit: boolean
  currentUserId?: string | null
}

export default function UserDetailClient({
  user,
  canEdit,
  currentUserId = null,
}: Props) {
  const router = useRouter()
  const [name, setName] = useState(user.full_name ?? '')
  const [moduleRoles, setModuleRoles] = useState<ModuleRoleMap>(() =>
    selectionFromProfile(user.roles, user.products)
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isPending, startTransition] = useTransition()

  const isSelf = !!currentUserId && currentUserId === user.id

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateReachUser(user.id, {
          fullName: name,
          moduleRoles,
        })
        router.push('/ops/users')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  function requestResetPassword() {
    if (!canEdit) return
    setConfirmAction('reset-password')
  }

  function requestDelete() {
    if (!canEdit || isSelf) return
    setConfirmAction('delete-user')
  }

  function runConfirmedAction() {
    if (!confirmAction) return
    const action = confirmAction
    setError(null)

    if (action === 'reset-password') {
      startTransition(async () => {
        try {
          await resetReachUserPassword(user.id)
          setConfirmAction(null)
          setSaved(true)
          router.refresh()
        } catch (err) {
          setConfirmAction(null)
          setError(
            err instanceof Error ? err.message : 'Could not reset password'
          )
        }
      })
      return
    }

    startTransition(async () => {
      try {
        await deleteReachUser(user.id)
        setConfirmAction(null)
        router.push('/ops/users')
        router.refresh()
      } catch (err) {
        setConfirmAction(null)
        setError(err instanceof Error ? err.message : 'Could not delete user')
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/ops/users" className={styles.backLink}>
          ← All users
        </Link>
        {!canEdit && <span className={styles.viewOnlyBadge}>View only</span>}
      </div>

      <div className={styles.titleBlock}>
        <h2 className={styles.title}>{user.full_name || user.email}</h2>
        <p className={styles.sub}>{user.email}</p>
      </div>

      <form className={styles.detailForm} onSubmit={handleSave}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Full name</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!canEdit}
            required
          />
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input className={styles.input} value={user.email} disabled readOnly />
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Created</span>
            <div className={styles.staticValue}>
              {formatWhen(user.created_at)}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Last modified</span>
            <div className={styles.staticValue}>
              {formatWhen(user.updated_at)}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Password last changed</span>
            <div className={styles.staticValue}>
              {formatWhen(user.password_changed_at)}
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Module access</span>
          <ModuleRoleMatrix
            value={moduleRoles}
            onChange={setModuleRoles}
            disabled={!canEdit}
          />
        </div>

        {error && <p className={styles.formError}>{error}</p>}
        {saved && !error && <p className={styles.savedMsg}>Saved</p>}

        {canEdit && (
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={requestDelete}
              disabled={isPending || isSelf}
              title={isSelf ? 'You cannot delete your own account' : undefined}
            >
              Delete user
            </button>
            <div className={styles.actionsSpacer} />
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={requestResetPassword}
              disabled={isPending}
            >
              Reset password to {DEFAULT_TEMP_PASSWORD}
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </form>

      {confirmAction === 'reset-password' && (
        <ConfirmModal
          title="Reset password?"
          message={`Reset password for ${user.email} to temporary password ${DEFAULT_TEMP_PASSWORD}?\n\nThey will need to change it on next sign-in.`}
          confirmLabel="Reset password"
          danger
          loading={isPending}
          onConfirm={runConfirmedAction}
          onClose={() => {
            if (!isPending) setConfirmAction(null)
          }}
        />
      )}

      {confirmAction === 'delete-user' && (
        <ConfirmModal
          title="Delete user?"
          message={`Permanently delete ${user.full_name || user.email}?\n\nThis removes their login and cannot be undone.`}
          confirmLabel="Delete user"
          danger
          loading={isPending}
          onConfirm={runConfirmedAction}
          onClose={() => {
            if (!isPending) setConfirmAction(null)
          }}
        />
      )}
    </div>
  )
}
