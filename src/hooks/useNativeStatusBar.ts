import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * In the iOS app the clock and battery icons don't follow the page, so pick the color that
 * reads against whatever sits under them. The Diary opens on its summary field, which is dark
 * in both themes. Other screens open on the page background. Style.Dark means light icons.
 */
export function useNativeStatusBar(dark: boolean) {
  const { pathname } = useLocation()
  const lightIcons = dark || pathname.startsWith('/diary')

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: lightIcons ? Style.Dark : Style.Light }).catch(() => {})
  }, [lightIcons])
}
