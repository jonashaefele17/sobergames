import type { CSSProperties } from 'react'

export const SPRING = { type: 'spring', stiffness: 170, damping: 24 } as const
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** CSS-Variable --team für alles, was in Teamfarbe erscheint. */
export const teamStyle = (color: string) => ({ '--team': color }) as CSSProperties
