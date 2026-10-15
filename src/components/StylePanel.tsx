import type { NameStyle, PaperDeco, ResumeTemplate, StyleOverride } from '../types'
import { NameArtPreview } from './nameArt'
import { XIcon } from './icons'

interface StylePanelProps {
  open: boolean
  dataName: string
  template: ResumeTemplate
  override: StyleOverride
  onChange: (next: StyleOverride) => void
  onClose: () => void
}

const ACCENT_SWATCHES = ['#1A1A1A', '#2B3A55', '#2563EB', '#8F7CC8', '#E86A5E', '#D97706', '#059669', '#4A5240', '#D98E73']

const NAME_STYLES: { id: NameStyle; label: string }[] = [
  { id: 'plain', label: '常规' },
  { id: 'shadow', label: '立体阴影' },
  { id: 'stroke', label: '描边空心' },
  { id: 'gradient', label: '渐变填充' },
  { id: 'spacing', label: '宽松字距' },
]

const DECOS: { id: PaperDeco; label: string }[] = [
  { id: 'none', label: '无插画' },
  { id: 'floral', label: '花卉' },
  { id: 'leaf', label: '枝叶' },
  { id: 'geo', label: '几何' },
  { id: 'blob', label: '渐变气泡' },
  { id: 'arch', label: '拱门' },
  { id: 'wave', label: '波浪' },
  { id: 'mountain', label: '山峦' },
  { id: 'starry', label: '星空' },
  { id: 'dots', label: '波点' },
  { id: 'stripes', label: '斜纹' },
  { id: 'halftone', label: '网点' },
  { id: 'confetti', label: '彩纸屑' },
]

/** 四角小星（预览用） */
function MiniSparkle({ className, size, accent }: { className?: string; size: number; accent: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1C12.8 6.4 15.6 9.2 21 10C15.6 10.8 12.8 13.6 12 19C11.2 13.6 8.4 10.8 3 10C8.4 9.2 11.2 6.4 12 1Z" fill={accent} />
    </svg>
  )
}

/** 装饰插画迷你预览 */
function DecoPreview({ deco, accent }: { deco: PaperDeco; accent: string }) {
  return (
    <div className="relative h-[52px] w-full overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white">
      {deco === 'floral' && (
        <>
          <svg className="absolute -right-2 -top-2" width="44" height="44" viewBox="0 0 44 44" fill="none">
            <g fill={accent} opacity={0.35}>
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <ellipse key={a} cx="22" cy="12" rx="4.5" ry="8" transform={`rotate(${a} 22 22)`} />
              ))}
            </g>
            <circle cx="22" cy="22" r="3.5" fill="#fff" />
          </svg>
          <svg className="absolute -bottom-1.5 -left-1.5" width="34" height="34" viewBox="0 0 44 44" fill="none">
            <g fill={accent} opacity={0.25}>
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <ellipse key={a} cx="22" cy="12" rx="4.5" ry="8" transform={`rotate(${a} 22 22)`} />
              ))}
            </g>
          </svg>
        </>
      )}
      {deco === 'geo' && (
        <>
          <span className="absolute right-0 top-0 h-7 w-7 rounded-bl-full" style={{ backgroundColor: accent, opacity: 0.2 }} />
          <span className="absolute right-[38px] top-2.5 h-4 w-4 rounded-full border-2" style={{ borderColor: accent, opacity: 0.35 }} />
          <span className="absolute bottom-1.5 left-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: accent, opacity: 0.18 }} />
        </>
      )}
      {deco === 'wave' && (
        <svg className="absolute bottom-0 left-0 w-full" height="20" viewBox="0 0 120 20" preserveAspectRatio="none" fill="none">
          <path d="M0 8C20 2 45 16 65 10C85 4 105 12 120 6V20H0V8Z" fill={accent} opacity={0.25} />
        </svg>
      )}
      {deco === 'leaf' && (
        <>
          <svg className="absolute -bottom-1 -left-1" width="52" height="32" viewBox="0 0 200 124" fill="none">
            <path d="M4 120C50 96 110 60 196 8" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity={0.4} />
            {[[46, 88, -38], [92, 60, -42], [136, 34, -40], [176, 13, -36]].map(([x, y, rot], i) => (
              <ellipse key={i} cx={x} cy={y} rx="14" ry="7" fill={accent} opacity={0.3} transform={`rotate(${rot} ${x} ${y})`} />
            ))}
          </svg>
          <svg className="absolute -right-1.5 -top-1" width="36" height="22" viewBox="0 0 200 124" fill="none" style={{ transform: 'scaleX(-1)' }}>
            <path d="M4 120C50 96 110 60 196 8" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity={0.3} />
            <ellipse cx="120" cy="55" rx="16" ry="8" fill={accent} opacity={0.28} transform="rotate(-42 120 55)" />
          </svg>
        </>
      )}
      {deco === 'blob' && (
        <>
          <span className="absolute -right-3 -top-3 h-12 w-12 rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, ${accent}, transparent 72%)`, opacity: 0.35 }} />
          <span className="absolute -bottom-4 -left-3 h-14 w-14 rounded-full" style={{ background: `radial-gradient(circle at 55% 40%, ${accent}, transparent 72%)`, opacity: 0.28 }} />
          <span className="absolute right-[42px] top-4 h-3.5 w-3.5 rounded-full border-[3px]" style={{ borderColor: accent, opacity: 0.3 }} />
        </>
      )}
      {deco === 'arch' && (
        <>
          <span className="absolute right-2 top-0 h-8 w-4 rounded-t-full" style={{ backgroundColor: accent, opacity: 0.3 }} />
          <span className="absolute right-[26px] top-0 h-11 w-4 rounded-t-full" style={{ backgroundColor: accent, opacity: 0.2 }} />
          <span className="absolute left-3 bottom-0 h-6 w-3.5 rounded-t-full" style={{ backgroundColor: accent, opacity: 0.22 }} />
          <span className="absolute left-[26px] bottom-3 h-3 w-3 rounded-full border-[2.5px]" style={{ borderColor: accent, opacity: 0.32 }} />
        </>
      )}
      {deco === 'mountain' && (
        <>
          <span className="absolute right-4 top-2 h-4 w-4 rounded-full" style={{ backgroundColor: accent, opacity: 0.35 }} />
          <svg className="absolute bottom-0 left-0 w-full" height="22" viewBox="0 0 120 22" preserveAspectRatio="none" fill="none">
            <path d="M0 14L24 4L48 14L72 8L98 16L120 10V22H0V14Z" fill={accent} opacity={0.22} />
            <path d="M0 19L30 12L62 20L92 15L120 19V22H0V19Z" fill={accent} opacity={0.28} />
          </svg>
        </>
      )}
      {deco === 'starry' && (
        <>
          <span className="absolute right-2 top-2 h-5 w-5 rounded-full" style={{ backgroundColor: accent, opacity: 0.3 }} />
          <span className="absolute right-[17px] top-[6px] h-4 w-4 rounded-full bg-white" />
          <MiniSparkle className="absolute right-[38px] top-2" size={9} accent={accent} />
          <MiniSparkle className="absolute right-[26px] top-[26px]" size={6} accent={accent} />
          <MiniSparkle className="absolute left-3 bottom-3" size={7} accent={accent} />
          <span className="absolute left-[34px] bottom-[14px] h-1 w-1 rounded-full" style={{ backgroundColor: accent, opacity: 0.4 }} />
          <span className="absolute right-[46px] bottom-2 h-1 w-1 rounded-full" style={{ backgroundColor: accent, opacity: 0.4 }} />
        </>
      )}
      {deco === 'dots' && (
        <>
          <svg className="absolute right-0 top-0" width="42" height="30" style={{ opacity: 0.35 }}>
            {Array.from({ length: 3 }).map((_, r) =>
              Array.from({ length: 5 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={c * 9 + 4} cy={r * 9 + 4} r="1.8" fill={accent} />
              )),
            )}
          </svg>
          <svg className="absolute bottom-0 left-0" width="42" height="30" style={{ opacity: 0.28 }}>
            {Array.from({ length: 3 }).map((_, r) =>
              Array.from({ length: 5 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={c * 9 + 4} cy={r * 9 + 4} r="1.8" fill={accent} />
              )),
            )}
          </svg>
        </>
      )}
      {deco === 'stripes' && (
        <>
          <svg className="absolute right-0 top-0" width="44" height="44" style={{ opacity: 0.28 }}>
            <defs><clipPath id="sp-stripe-tr"><path d="M0 0H44V44L0 0Z" /></clipPath></defs>
            <g clipPath="url(#sp-stripe-tr)" stroke={accent} strokeWidth="3.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={i} x1={-44 + i * 14} y1={44} x2={i * 14} y2={0} />
              ))}
            </g>
          </svg>
          <svg className="absolute bottom-0 left-0" width="36" height="36" style={{ opacity: 0.22 }}>
            <defs><clipPath id="sp-stripe-bl"><path d="M0 36L36 0L36 36L0 36Z" /></clipPath></defs>
            <g clipPath="url(#sp-stripe-bl)" stroke={accent} strokeWidth="3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <line key={i} x1={-36 + i * 14} y1={36} x2={i * 14} y2={0} />
              ))}
            </g>
          </svg>
        </>
      )}
      {deco === 'halftone' && (
        <>
          <svg className="absolute -right-2 -top-2" width="52" height="52" viewBox="0 0 52 52" style={{ opacity: 0.32 }}>
            <defs><clipPath id="sp-halftone"><circle cx="44" cy="8" r="38" /></clipPath></defs>
            <g clipPath="url(#sp-halftone)">
              {Array.from({ length: 6 }).map((_, r) =>
                Array.from({ length: 6 }).map((_, c) => {
                  const dist = Math.hypot(c * 8 - 42, r * 8 - 4) / 52
                  const radius = Math.max(0.4, 2.6 * (1 - dist))
                  return <circle key={`${r}-${c}`} cx={c * 8} cy={r * 8} r={radius} fill={accent} />
                }),
              )}
            </g>
          </svg>
          <span className="absolute -left-3 -bottom-3 h-9 w-9 rounded-full" style={{ backgroundColor: accent, opacity: 0.2 }} />
        </>
      )}
      {deco === 'confetti' && (
        <>
          <span className="absolute right-4 top-2 h-3 w-1.5 rounded-[1px]" style={{ backgroundColor: accent, opacity: 0.35, transform: 'rotate(24deg)' }} />
          <span className="absolute right-[30px] top-4 h-2 w-2 rounded-full" style={{ backgroundColor: accent, opacity: 0.3 }} />
          <span className="absolute right-2 top-[30px] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent, opacity: 0.22 }} />
          <span className="absolute left-3 bottom-2.5 h-2.5 w-1.5 rounded-[1px]" style={{ backgroundColor: accent, opacity: 0.3, transform: 'rotate(-30deg)' }} />
          <span className="absolute left-[26px] bottom-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent, opacity: 0.35 }} />
          <span className="absolute right-5 bottom-2 h-2 w-2 rounded-full" style={{ backgroundColor: accent, opacity: 0.28 }} />
        </>
      )}
    </div>
  )
}

export default function StylePanel({ open, dataName, template, override, onChange, onClose }: StylePanelProps) {
  if (!open) return null

  const previewAccent = override.accent || template.accent
  const previewSoft = override.accent ? `color-mix(in srgb, ${previewAccent} 10%, white)` : template.accentSoft

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35" onClick={onClose} role="presentation">
      <div
        className="flex max-h-[680px] w-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="自定义样式"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-7 py-5">
          <div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">自定义样式</div>
            <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">对所有模板生效，可与任意模板自由组合</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--chip-bg)] hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-7 overflow-y-auto px-7 py-6">
          {/* ===== 主题色 ===== */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">主题色</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                自定义
                <input
                  type="color"
                  value={previewAccent}
                  onChange={(e) => onChange({ ...override, accent: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-[var(--border-subtle)] bg-white p-0.5"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onChange({ ...override, accent: null })}
                className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors ${
                  !override.accent
                    ? 'border-[var(--accent)] bg-[var(--accent-tint)] font-medium text-[var(--accent-text)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span className="h-3 w-3 rounded-full border border-[var(--border-strong)]" style={{ background: `linear-gradient(135deg, ${template.dot} 50%, ${template.accentSoft} 50%)` }} />
                跟随模板
              </button>
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...override, accent: c })}
                  aria-label={`主题色 ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    override.accent === c ? 'border-[var(--accent)] ring-2 ring-[var(--accent-tint)]' : 'border-transparent ring-1 ring-black/10'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </section>

          {/* ===== 姓名艺术字 ===== */}
          <section className="flex flex-col gap-3">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">姓名艺术字</span>
            <div className="flex flex-wrap gap-2.5">
              {NAME_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ...override, nameStyle: s.id })}
                  className={`flex h-[64px] min-w-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border px-4 transition-all ${
                    override.nameStyle === s.id
                      ? 'border-[var(--accent)] bg-[var(--accent-tint)]/50 ring-2 ring-[var(--accent-tint)]'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <span className="flex h-6 items-center">
                    <NameArtPreview style={s.id} accent={previewAccent} soft={previewSoft}>
                      {dataName.slice(0, 3) || '姓名'}
                    </NameArtPreview>
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ===== 装饰插画 ===== */}
          <section className="flex flex-col gap-3">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">装饰插画</span>
            <div className="grid grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => onChange({ ...override, decoration: 'auto' })}
                className={`flex flex-col gap-1.5 rounded-xl border p-2 transition-all ${
                  override.decoration === 'auto'
                    ? 'border-[var(--accent)] bg-[var(--accent-tint)]/50 ring-2 ring-[var(--accent-tint)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="relative h-[52px] w-full overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white">
                  {template.decoration ? <DecoPreview deco={template.decoration} accent={template.accent} /> : null}
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  模板默认{template.decoration ? `（${DECOS.find((d) => d.id === template.decoration)?.label}）` : '（无）'}
                </span>
              </button>
              {DECOS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChange({ ...override, decoration: d.id })}
                  className={`flex flex-col gap-1.5 rounded-xl border p-2 transition-all ${
                    override.decoration === d.id
                      ? 'border-[var(--accent)] bg-[var(--accent-tint)]/50 ring-2 ring-[var(--accent-tint)]'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <DecoPreview deco={d.id} accent={previewAccent} />
                  <span className="text-[10px] text-[var(--text-tertiary)]">{d.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
