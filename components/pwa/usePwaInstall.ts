'use client'

import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayStandalone || iosStandalone
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIos && isSafari
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [iosInstallable, setIosInstallable] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIosInstallable(isIosSafari() && !isStandalone())

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setInstalled(true)
      setIosInstallable(false)
      setIosHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = !installed && (!!deferred || iosInstallable)

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') {
        setDeferred(null)
        setInstalled(true)
      }
      return
    }
    if (iosInstallable) {
      setIosHint(true)
    }
  }, [deferred, iosInstallable])

  return { canInstall, installed, install, iosHint, dismissIosHint: () => setIosHint(false) }
}
