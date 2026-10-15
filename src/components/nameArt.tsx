import type { CSSProperties } from 'react'
import type { NameStyle } from '../types'

/** 姓名艺术字的 CSS（纸张与样式面板预览共用） */
export function nameStyleCss(style: NameStyle): CSSProperties {
  switch (style) {
    case 'shadow':
      return {
        textShadow: '3px 3px 0 var(--paper-accent-soft), 4px 4px 0 rgba(26, 26, 26, 0.12)',
      }
    case 'stroke':
      return {
        WebkitTextStroke: '1.3px var(--paper-accent)',
        color: '#ffffff',
      }
    case 'gradient':
      return {
        backgroundImage: 'linear-gradient(100deg, var(--paper-accent), color-mix(in srgb, var(--paper-accent) 35%, #E86A5E))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    case 'spacing':
      return {
        letterSpacing: '0.32em',
      }
    default:
      return {}
  }
}

/** 渲染姓名艺术字预览（样式面板用） */
export function NameArtPreview({ style, accent, soft, children }: { style: NameStyle; accent: string; soft: string; children: string }) {
  const css = nameStyleCss(style)
  const styled: CSSProperties =
    style === 'stroke'
      ? { ...css, WebkitTextStroke: `1px ${accent}` }
      : style === 'shadow'
        ? { ...css, textShadow: `2px 2px 0 ${soft}, 3px 3px 0 rgba(26,26,26,0.12)` }
        : style === 'gradient'
          ? { ...css, backgroundImage: `linear-gradient(100deg, ${accent}, color-mix(in srgb, ${accent} 35%, #E86A5E))` }
          : css

  return (
    <span className="text-[19px] font-semibold leading-none" style={styled}>
      {children}
    </span>
  )
}
