'use client'

import ModuleTopbar from '@/components/layout/ModuleTopbar'
import type { Module } from '@/lib/roles'

const SUPPORT_TITLES = [
  { match: '/calendar', title: 'Roster' },
  { match: '/chats', title: 'Chats' },
  { match: '/activity', title: 'Activity' },
  { match: '/time', title: 'Time Logging' },
  { match: '/reports', title: 'Hours' },
  { match: '/settings', title: 'Settings' },
  { match: '/dashboard', title: 'Dashboard' },
]

export default function SupportTopbar({
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
      titles={SUPPORT_TITLES}
      fallbackTitle="Support"
    />
  )
}
