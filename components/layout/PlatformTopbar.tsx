'use client'

import ModuleTopbar from '@/components/layout/ModuleTopbar'
import type { Module } from '@/lib/roles'

const PLATFORM_TITLES = [{ match: '/users', title: 'Users' }]

/** Platform Ops topbar (Users). Same chrome as product Ops. */
export default function PlatformTopbar({
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
      titles={PLATFORM_TITLES}
      fallbackTitle="Home"
    />
  )
}
