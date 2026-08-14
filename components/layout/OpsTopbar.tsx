'use client'

import ModuleTopbar from '@/components/layout/ModuleTopbar'
import type { Module } from '@/lib/roles'

const OPS_TITLES = [
  { match: '/management', title: 'Tenants' },
  { match: '/tenants', title: 'Tenants' },
  { match: '/logs', title: 'Logs' },
  { match: '/users', title: 'Users' },
  { match: '/subscription', title: 'Subscription' },
  { match: '/reports', title: 'Reports' },
]

export default function OpsTopbar({
  modules,
  activeModule,
}: {
  modules: Module[]
  activeModule: Module
}) {
  return (
    <ModuleTopbar
      modules={modules}
      activeModule={activeModule}
      titles={OPS_TITLES}
      fallbackTitle="Home"
    />
  )
}
