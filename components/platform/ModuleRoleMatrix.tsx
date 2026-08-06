'use client'

import {
  ASSIGNABLE_MODULES,
  MODULE_LABELS,
  type Module,
} from '@/lib/modules'
import {
  PLATFORM_ROLE_LABELS,
  allowedRolesForModule,
  toggleModuleRole,
  type ModuleRoleMap,
  type PlatformRole,
} from '@/lib/platform/access-model'
import styles from './Users.module.css'

interface Props {
  value: ModuleRoleMap
  onChange: (next: ModuleRoleMap) => void
  disabled?: boolean
}

export default function ModuleRoleMatrix({
  value,
  onChange,
  disabled = false,
}: Props) {
  function onToggle(mod: Module, role: PlatformRole) {
    if (disabled) return
    onChange(toggleModuleRole(value, mod, role))
  }

  return (
    <div className={styles.matrixWrap}>
      <table className={styles.matrixTable}>
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col">Roles</th>
          </tr>
        </thead>
        <tbody>
          {ASSIGNABLE_MODULES.map(mod => {
            const allowed = allowedRolesForModule(mod)
            const selected = value[mod] ?? []
            return (
              <tr key={mod}>
                <th scope="row" className={styles.matrixModule}>
                  {MODULE_LABELS[mod]}
                </th>
                <td>
                  <div className={styles.matrixRoles}>
                    {allowed.map(role => (
                      <label key={role} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={selected.includes(role)}
                          onChange={() => onToggle(mod, role)}
                          disabled={disabled}
                        />
                        {PLATFORM_ROLE_LABELS[role]}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.hint}>
        Uncheck all roles on a module to remove access. For Ops, Admin and User
        are exclusive (Admin can manage users).
      </p>
    </div>
  )
}
