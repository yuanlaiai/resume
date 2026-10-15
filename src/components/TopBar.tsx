import { useRef, useState } from 'react'
import { RESUME_TEMPLATES } from '../data/templates'
import type { ResumeTemplate, StyleOverride } from '../types'
import { DownloadIcon, GridIcon, ImportIcon, LogoIcon, PaletteIcon, ShareIcon, SparklesIcon, XIcon } from './icons'
import StylePanel from './StylePanel'

interface TopBarProps {
  templateId: string
  onSelectTemplate: (id: string) => void
  onShare: () => void
  onPrint: () => void
  dataName: string
  styleOverride: StyleOverride
  onChangeStyle: (next: StyleOverride) => void
  /** 导入本地 PDF/Word 简历并自动填充 */
  onImportFile: (file: File) => Promise<void>
  importing: boolean
  /** 打开 AI 助手面板 */
  onOpenAi: () => void
}

/** 模板库风格分类展示顺序 */
const CATEGORY_ORDER = ['简约经典', '商务正式', '清新彩色', '创意设计', '深色质感'] as const

/** 模板库卡片缩略图：按版式结构差异绘制迷你纸张 */
function Thumb({ t }: { t: ResumeTemplate }) {
  const dark = !!t.sidebarDark
  const dk = !!t.paperDark
  const lineC = dk ? 'rgba(255,255,255,0.35)' : '#DEDBD4'
  const line = (w: string) => <span className="h-[2.5px] shrink-0 rounded-full" style={{ width: w, background: lineC }} />
  const wline = (w: string) => <span className="h-[2.5px] shrink-0 rounded-full bg-white/50" style={{ width: w }} />

  return (
    <div className="flex h-[118px] items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-preview)]">
      <div
        className="relative flex h-[94px] w-[66px] overflow-hidden rounded-[2px] shadow-[0_2px_6px_rgba(15,20,25,0.14)]"
        style={{ background: dk ? '#26241f' : '#fff' }}
      >
        {/* 双栏版式：左侧信息条 */}
        {t.layout === 'sidebar' && (
          <div
            className="flex w-[20px] shrink-0 flex-col items-center gap-[5px] pt-[9px]"
            style={{ background: dark || dk ? t.accent : t.accentSoft }}
          >
            <span
              className="h-[9px] w-[9px] rounded-full"
              style={{ background: dark || dk ? 'rgba(255,255,255,0.55)' : t.accent, opacity: dark || dk ? 1 : 0.55 }}
            />
            {dark || dk ? <>{wline('10px')}{wline('10px')}{wline('7px')}</> : <>{line('10px')}{line('10px')}{line('7px')}</>}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-[4.5px] px-2 pt-[9px]">
          {/* 页眉色带 */}
          {t.headerBand && (
            <span
              className="-mx-2 -mt-[9px] mb-[3px] h-[15px]"
              style={{ background: t.headerDark ? t.accent : t.accentSoft }}
            />
          )}
          {/* 左侧色轨（双栏经典） */}
          {t.rail && <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: t.accent }} />}

          {/* 标题条：按标题样式区分 */}
          {t.titleStyle === 'tag' ? (
            <span className="flex h-[7px] w-[22px] shrink-0 items-center justify-center rounded-[2px]" style={{ background: t.accent }} />
          ) : (
            <span className="h-[4px] w-[30px] shrink-0 rounded-full" style={{ background: t.accent }} />
          )}
          {(t.titleStyle === 'underline' || t.titleStyle === 'line') && (
            <span className="h-[1.5px] w-full shrink-0 rounded-full" style={{ background: t.accent, opacity: 0.55 }} />
          )}
          {line('40px')}
          {line('46px')}

          {/* 应届生版式：教育背景前置色块 */}
          {t.layout === 'edu-first' && (
            <span className="mt-[2px] h-[9px] w-full shrink-0 rounded-[2px]" style={{ background: dk ? 'rgba(255,255,255,0.12)' : t.accentSoft }} />
          )}

          {/* 时间轴版式：圆点 + 竖线 */}
          {t.layout === 'timeline' ? (
            <div className="relative mt-[3px] flex flex-col gap-[7px] pl-[9px]">
              <span className="absolute bottom-[2px] left-0 top-[2px] w-px" style={{ background: t.accent, opacity: 0.4 }} />
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-[4px]">
                  <span className="h-[5px] w-[5px] shrink-0 rounded-full border" style={{ borderColor: t.accent }} />
                  {line('34px')}
                </div>
              ))}
            </div>
          ) : (
            <>
              {line('46px')}
              {line('38px')}
            </>
          )}
          {line('24px')}
        </div>
      </div>
    </div>
  )
}

export default function TopBar({ templateId, onSelectTemplate, onShare, onPrint, dataName, styleOverride, onChangeStyle, onImportFile, importing, onOpenAi }: TopBarProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pick = (id: string) => {
    onSelectTemplate(id)
    setGalleryOpen(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (!file) return
    await onImportFile(file)
  }

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between gap-2 whitespace-nowrap border-b border-[var(--border-subtle)] bg-white px-4 md:px-6">
      {/* 左侧：品牌 + 快捷模板 + 模板库入口 */}
      <div className="flex h-fit min-w-0 items-center gap-3 md:gap-5">
        <div className="flex h-fit items-center gap-2.5">
          <LogoIcon className="h-[30px] w-[30px]" />
          <span className="hidden text-[16px] font-semibold text-[var(--text-primary)] md:inline md:text-[17px]">ResumeCraft</span>
        </div>

        <div className="flex h-fit items-center gap-2">
          {RESUME_TEMPLATES.slice(0, 5).map((t) => {
            const active = t.id === templateId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className={`hidden h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors md:flex ${
                  active
                    ? 'border border-[#6D8A82] bg-[var(--accent-tint)] font-medium text-[var(--accent-text)]'
                    : 'bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:bg-[#EDEAE3]'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.dot }} />
                {t.name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
          >
            <GridIcon className="h-3.5 w-3.5 shrink-0" />
            模板库<span className="hidden sm:inline"> · {RESUME_TEMPLATES.length} 套</span>
          </button>
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex h-fit shrink-0 items-center gap-2 md:gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 text-[13px] font-medium text-[var(--text-dark)] transition-colors hover:bg-[#FAFAF7] disabled:opacity-60 md:gap-2 md:px-3.5"
        >
          <ImportIcon className={`h-4 w-4 text-[var(--text-secondary)] ${importing ? 'animate-pulse' : ''}`} />
          <span className="md:hidden">{importing ? '解析中' : '导入'}</span>
          <span className="hidden md:inline">{importing ? '解析中…' : '导入简历'}</span>
        </button>
        <button
          type="button"
          onClick={onOpenAi}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[#6D8A82]/40 bg-[var(--accent-tint)] px-2.5 text-[13px] font-medium text-[var(--accent-text)] transition-colors hover:bg-[#E3EFEC] md:gap-2 md:px-3.5"
        >
          <SparklesIcon className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">AI 助手</span>
        </button>
        <button
          type="button"
          onClick={() => setStyleOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 text-[13px] font-medium text-[var(--text-dark)] transition-colors hover:bg-[#FAFAF7] md:gap-2 md:px-3.5"
        >
          <PaletteIcon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="hidden md:inline">样式</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 text-[13px] font-medium text-[var(--text-dark)] transition-colors hover:bg-[#FAFAF7] md:gap-2 md:px-3.5"
        >
          <ShareIcon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="hidden md:inline">分享链接</span>
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent-strong)] px-3 text-[13px] font-medium text-white shadow-[0_2px_6px_rgba(79,138,130,0.28)] transition-colors hover:bg-[#457C74] md:gap-2 md:px-4"
        >
          <DownloadIcon className="h-4 w-4 shrink-0" />
          <span className="md:hidden">PDF</span>
          <span className="hidden md:inline">下载 PDF</span>
        </button>
      </div>

      {/* ===== 自定义样式面板 ===== */}
      <StylePanel
        open={styleOpen}
        dataName={dataName}
        template={RESUME_TEMPLATES.find((t) => t.id === templateId) ?? RESUME_TEMPLATES[0]}
        override={styleOverride}
        onChange={onChangeStyle}
        onClose={() => setStyleOpen(false)}
      />

      {/* ===== 模板库弹窗 ===== */}
      {galleryOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/35"
          onClick={() => setGalleryOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[88vh] w-[min(960px,calc(100vw-24px))] flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="模板库"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-7 py-5">
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">模板库</div>
                <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {RESUME_TEMPLATES.length} 套职业风格 · 按样式分类 · 未编辑内容时切换模板会自动填入对应职业示例
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--chip-bg)] hover:text-[var(--text-primary)]"
                aria-label="关闭"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-7 pt-5 md:px-7">
              {CATEGORY_ORDER.map((cat) => {
                const list = RESUME_TEMPLATES.filter((t) => (t.category ?? '简约经典') === cat)
                if (list.length === 0) return null
                return (
                  <section key={cat} className="mb-6 last:mb-0">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{cat}</span>
                      <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{list.length} 套</span>
                      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {list.map((t) => {
                        const active = t.id === templateId
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => pick(t.id)}
                            className={`flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-all ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent-tint)]/50 ring-2 ring-[var(--accent-tint)]'
                                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:shadow-sm'
                            }`}
                          >
                            <Thumb t={t} />
                            <div className="flex items-center justify-between px-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.dot }} />
                                <span className="text-[13px] font-medium text-[var(--text-primary)]">{t.name}</span>
                              </div>
                              <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {t.profession}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
