import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { JobProject, ResumeData, ResumeTemplate, StyleOverride, SectionTitleKey } from '../types'
import { SECTION_TITLE_DEFAULTS } from '../types'
import { nameStyleCss } from './nameArt'
import PaperDeco from './PaperDeco'

interface ResumePaperProps {
  data: ResumeData
  template: ResumeTemplate
  highlight: string | null
  /** 打印副本：去掉阴影与动效 */
  print?: boolean
  /** 用户自定义样式（主题色 / 艺术字 / 插画） */
  styleOverride?: StyleOverride
  /** 页数变化回调（携带每页的区块 id 分组，供打印副本复用测量结果） */
  onPagesChange?: (pages: string[][]) => void
  /** 外部共享的分页结果（打印副本在 display:none 中无法自测，直接复用屏幕实例的测量值） */
  externalPages?: string[][] | null
  /** 自定义区块顺序（拖拽排序结果），null/缺省 = 模板默认顺序 */
  order?: string[] | null
  /** 拖拽排序回调 */
  onReorder?: (dragId: string, targetId: string, pos: 'before' | 'after') => void
  /** 当前渲染的区块 id 列表上抛（App 计算排序用） */
  onBlocksChange?: (ids: string[]) => void
  /** 点击纸张区块 → 打开编辑面板对应模块（打印副本不传） */
  onEditRequest?: (section: 'personal' | 'jobs' | 'projects' | 'edu' | 'skills' | 'summary') => void
  /** 修改区块标题名称（点击纸张标题直接编辑，打印副本不传） */
  onRenameTitle?: (key: SectionTitleKey, value: string) => void
}

const pulse = (key: string, highlight: string | null) => (highlight === key ? 'preview-pulse' : '')

/** 富文本渲染：支持 **加粗** 与 ==关键字突出== 行内标记（编辑描述时可用，纸张实时渲染） */
export function renderRich(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g)
  if (parts.length === 1) return text
  return parts.map((seg, i) => {
    if (i % 2 === 0) return seg
    if (seg.startsWith('**')) return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>
    // ==关键字突出==：主题色 + 下划线（打印时也能保留，不依赖背景色）
    return (
      <span key={i} className="font-semibold text-[var(--paper-accent)] underline decoration-[var(--paper-accent)] decoration-[1.5px] underline-offset-[3px]">
        {seg.slice(2, -2)}
      </span>
    )
  })
}

/** 描述单行渲染：`- `/`· `/`• ` 前缀 → 无序圆点；`1.`/`1、` 前缀 → 有序序号；其余为普通段落 */
export function renderDescLine(line: string, cls: string): ReactNode {
  const ul = line.match(/^\s*[-–—*•·]\s*(.*)$/)
  if (ul) {
    return (
      <p className={`${cls} flex gap-1.5`}>
        <span className="shrink-0 leading-[17px] text-[var(--paper-accent)]">•</span>
        <span className="min-w-0 flex-1">{renderRich(ul[1])}</span>
      </p>
    )
  }
  const ol = line.match(/^\s*(\d{1,2})[.、)]\s*(.*)$/)
  if (ol) {
    return (
      <p className={`${cls} flex gap-1.5`}>
        <span className="shrink-0 font-medium leading-[17px] text-[var(--paper-accent)]">{ol[1]}.</span>
        <span className="min-w-0 flex-1">{renderRich(ol[2])}</span>
      </p>
    )
  }
  return <p className={cls}>{renderRich(line)}</p>
}

/* ---------------- 经历条目：文档式「标签：内容」规范 ---------------- */

/**
 * 「角色：/ 技术栈：/ 核心职责：/ 项目成果：」等标签：加粗深色 + 全角冒号，
 * 内容与标签同行接排，折行后顶格回到行首 —— 不做宽悬挂缩进，整体像一篇文章而不是卡片。
 */
const kvLabelCls = 'font-semibold text-[var(--text-primary)]'

/** 正文公共字号（10.5px / 行高 18px） */
const cardBodyCls = 'text-[10px] leading-[17px] text-[var(--text-body)]'

/** 「标签：内容」行（内容为 ReactNode，直接接排在冒号后） */
function renderKvLine(label: string, content: ReactNode, cls = ''): ReactNode {
  return (
    <div className={`${cardBodyCls} ${cls}`}>
      <span className={kvLabelCls}>{label}：</span>
      {content}
    </div>
  )
}

/** 列表条目的层级缩进：只需分清「标签 → 条目」一层关系，保持紧凑 */
const DUTY_INDENT = 'pl-[7px]'

/** 行首是否为列表标记（有序 / 无序）：这类行不能与标签同行接排，标签需独行 */
const isListLine = (line: string) => /^\s*(?:\d{1,2}\s*[.、)]|[-–—*•·])\s*/.test(line)

/** 「项目描述：」类标签 + 描述行：散文接排在标签后；首行即列表时标签独行、列表另起 */
function renderLabeledDesc(label: string, line: string, pulseCls = ''): ReactNode {
  if (isListLine(line)) {
    return (
      <>
        <div className={`${cardBodyCls} ${pulseCls}`}>
          <span className={kvLabelCls}>{label}：</span>
        </div>
        {renderDescLine(line, cardBodyCls)}
      </>
    )
  }
  return (
    <div className={`${cardBodyCls} ${pulseCls}`}>
      <span className={kvLabelCls}>{label}：</span>
      {renderRich(line)}
    </div>
  )
}

/** 去掉技能条目自带的序号前缀（「1、」「2.」「一）」），由纸张统一编号，避免出现两重序号 */
export const stripSkillOrdinal = (s: string): string =>
  s.replace(/^\s*(?:\d{1,2}\s*[.、)）]|[一二三四五六七八九十]{1,2}\s*[.、)）])\s*/, '')

/** 把多行要点压成一行文本（去掉行首列表符号，用全角空格分隔） */
export const joinPoints = (text: string): string =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-–—*•·]\s*/, ''))
    .join('　')

/** 描述行续块（job-0:d1 / job-0:p1:y0 / proj-0:r 等）：分页可拆分的最小粒度，随经历头行跨页接排 */
const isDescCont = (id: string) => /^[a-z]+-\d+:(?:p\d+:)?[a-z]\d*$/.test(id)

/** 经历/项目头行块（job-0 / job-0:p1）：与其后的首条续块同页，避免头行孤立在页尾 */
const isEntryHead = (id: string) => /^[a-z]+-\d+(?::p\d+)?$/.test(id)

/** 纸张模块小图标（线性描边，继承 currentColor） */
function PaperIcon({ kind, size = 13 }: { kind: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (kind) {
    case 'jobs':
      return (
        <svg {...p}>
          <rect x="2.5" y="7" width="19" height="13" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      )
    case 'edu':
      return (
        <svg {...p}>
          <path d="M22 9.5 12 4.5l-10 5 10 5 10-5Z" />
          <path d="M6.5 11.8v4.4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.4" />
        </svg>
      )
    case 'skills':
      return (
        <svg {...p}>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9 2.9-6Z" />
        </svg>
      )
    case 'summary':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 16.5v-5" />
          <path d="M12 8h.01" />
        </svg>
      )
    case 'proj':
      return (
        <svg {...p}>
          <path d="M3.5 6.5 12 3l8.5 3.5L12 10 3.5 6.5Z" />
          <path d="M3.5 6.5v6c0 1.2 1.5 2.2 3.5 3M20.5 6.5v6c0 1.2-1.5 2.2-3.5 3" />
          <path d="M12 10v7.5" />
          <path d="M7 19.2c1.4.8 3.1 1.3 5 1.3s3.6-.5 5-1.3" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...p}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05Z" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...p}>
          <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...p}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    default:
      return null
  }
}

/** A4 页高 792px，上下内边距 44px → 单页内容容量 */
const PAGE_H = 792
const PAD_Y = 44
const SIDEBAR_PAD_Y = 40

/** 纸张上的证件照：1 寸照比例（2.5:3.5）竖版矩形，无照片时显示姓名首字占位 */
function PaperAvatar({ data, size, dark, highlight }: { data: ResumeData; size: string; dark?: boolean; highlight: string | null }) {
  const base = `${size} ${pulse('avatar', highlight)} shrink-0 overflow-hidden rounded-[3px]`
  if (data.avatar) {
    return (
      <img
        src={data.avatar}
        alt={data.name}
        className={`${base} object-cover ${dark ? 'ring-2 ring-white/40' : 'ring-1 ring-black/10'}`}
      />
    )
  }
  return (
    <div
      className={`${base} flex items-center justify-center text-[19px] font-semibold ${
        dark ? 'bg-white/15 text-white ring-1 ring-white/30' : 'bg-[var(--paper-accent-soft)] text-[var(--paper-accent)] ring-1 ring-black/5'
      }`}
    >
      {data.name.charAt(0) || '?'}
    </div>
  )
}

/** 可编辑标题文字：点击进入编辑，Enter/失焦保存，Escape 还原；阻止冒泡避免触发拖拽与区块编辑联动 */
function EditableTitleText({ text, onRename, extraCls }: { text: string; onRename?: (v: string) => void; extraCls?: string }) {
  if (!onRename) return <>{text}</>
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => {
        const v = (e.currentTarget.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (v && v !== text) onRename(v)
        else if (!v) e.currentTarget.textContent = text // 空名还原
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.currentTarget.textContent = text
          e.currentTarget.blur()
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`cursor-text rounded-[2px] outline-none transition-colors hover:bg-black/5 focus:bg-black/10 ${extraCls ?? ''}`}
      title="点击可修改标题名称"
    >
      {text}
    </span>
  )
}

/** 纸张区块标题：按模板 titleStyle 渲染四种风格；small 用于侧栏内；titleKey + onRename 时标题可点击改名 */
function SecTitle({
  title,
  titleKey,
  template,
  highlight,
  dark,
  small,
  onRenameTitle,
}: {
  title: string
  titleKey?: SectionTitleKey
  template: ResumeTemplate
  highlight: string | null
  dark?: boolean
  small?: boolean
  onRenameTitle?: (key: SectionTitleKey, value: string) => void
}) {
  const style = template.titleStyle ?? 'bar'
  const textSize = small ? 'text-[10.5px]' : 'text-[12px]'
  /* 模板启用图标时，按区块 key 映射小图标（自定义名称不影响图标） */
  const iconKind = titleKey === 'jobs' ? 'jobs' : titleKey === 'projects' ? 'proj' : titleKey === 'edu' ? 'edu' : titleKey === 'skills' ? 'skills' : 'summary'
  const useIcon = !!template.icons
  const rename = titleKey && onRenameTitle ? (v: string) => onRenameTitle(titleKey, v) : undefined

  if (style === 'tag') {
    // 实色圆角标签白字（商务标签风）
    return (
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--paper-accent)] px-2.5 py-[3px] ${textSize} font-semibold text-white ${pulse(`title:${title}`, highlight)}`}
        >
          {useIcon && <PaperIcon kind={iconKind} size={12} />}
          <EditableTitleText text={title} onRename={rename} extraCls="hover:bg-white/15 focus:bg-white/25" />
        </span>
      </div>
    )
  }

  if (style === 'underline') {
    // 标题 + 通栏细色条（清爽线条风）
    return (
      <div className="flex flex-col gap-[5px]">
        <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold ${dark ? 'text-white' : 'text-[var(--text-primary)]'} ${pulse(`title:${title}`, highlight)}`}>
          {useIcon && (
            <span className="text-[var(--paper-accent)]">
              <PaperIcon kind={iconKind} />
            </span>
          )}
          <EditableTitleText text={title} onRename={rename} />
        </span>
        <span className="h-[2px] w-full rounded-full bg-[var(--paper-accent)] opacity-60" />
      </div>
    )
  }

  if (style === 'docer') {
    // 宋体公文风：黑色实心小方块 + 加粗标题 + 细灰线贯穿行尾
    return (
      <div className="flex items-center gap-2">
        <span className="h-[7px] w-[7px] shrink-0 bg-[var(--paper-accent)]" />
        <span
          className={`${small ? 'text-[10.5px]' : 'text-[12.5px]'} font-bold tracking-wide ${
            dark ? 'text-white' : 'text-[var(--text-primary)]'
          } ${pulse(`title:${title}`, highlight)}`}
        >
          <EditableTitleText text={title} onRename={rename} />
        </span>
        <span className="h-px flex-1 bg-[var(--paper-accent)] opacity-25" />
      </div>
    )
  }

  if (style === 'line') {
    // 强调色标题 + 通栏细分隔线（素雅衬线风）
    return (
      <div className="flex flex-col gap-[5px] border-b border-[var(--paper-accent)] pb-[5px] opacity-90">
        <span className={`inline-flex items-center gap-1.5 ${textSize} font-semibold tracking-wide text-[var(--paper-accent)] ${pulse(`title:${title}`, highlight)}`}>
          {useIcon && <PaperIcon kind={iconKind} />}
          <EditableTitleText text={title} onRename={rename} />
        </span>
      </div>
    )
  }

  // 默认：左侧小竖条（极简模板无竖条；启用图标时图标替代竖条）
  return (
    <div className="flex items-center gap-2">
      {useIcon ? (
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-[var(--paper-accent-soft)] text-[var(--paper-accent)]">
          <PaperIcon kind={iconKind} size={11} />
        </span>
      ) : (
        !small && template.id !== 'minimal' && <span className="h-[12px] w-[3px] rounded-[2px] bg-[var(--paper-accent)]" />
      )}
      <span
        className={`${textSize} font-semibold ${
          dark ? 'text-white' : 'text-[var(--text-primary)]'
        } ${pulse(`title:${title}`, highlight)}`}
      >
        <EditableTitleText text={title} onRename={rename} />
      </span>
    </div>
  )
}

interface Block {
  id: string
  node: ReactNode
}

/** 拖拽把手图标（6 点抓手） */
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.3" />
      <circle cx="7.5" cy="2.5" r="1.3" />
      <circle cx="2.5" cy="7" r="1.3" />
      <circle cx="7.5" cy="7" r="1.3" />
      <circle cx="2.5" cy="11.5" r="1.3" />
      <circle cx="7.5" cy="11.5" r="1.3" />
    </svg>
  )
}

/**
 * 可拖拽的内容区块：悬停左上角出现把手，按下后拖动到目标区块上/下方插入。
 * disabled 时退化为普通包裹层（contents 用于页眉带布局穿透）。
 */
function DraggableBlock({
  id,
  label,
  enabled,
  contents,
  draggingRef,
  onReorder,
  onClick,
  children,
}: {
  id: string
  label: string
  enabled: boolean
  contents?: boolean
  draggingRef: { current: string | null }
  onReorder?: (dragId: string, targetId: string, pos: 'before' | 'after') => void
  /** 点击区块 → 跳到编辑面板对应模块（print 副本不传） */
  onClick?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [armed, setArmed] = useState(false) // 按下把手后才允许整块拖拽，避免影响文本选择
  const [isDragging, setIsDragging] = useState(false)
  const [hint, setHint] = useState<'before' | 'after' | null>(null)

  if (!enabled || !onReorder) {
    return (
      <div className={contents ? 'contents' : undefined} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`group/blk relative ${isDragging ? 'opacity-40' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      draggable={armed}
      onClick={onClick}
      onDragStart={(e) => {
        draggingRef.current = id
        setIsDragging(true)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
      }}
      onDragEnd={() => {
        draggingRef.current = null
        setIsDragging(false)
        setArmed(false)
      }}
      onDragOver={(e) => {
        if (!draggingRef.current || draggingRef.current === id) return
        e.preventDefault()
        const rect = ref.current?.getBoundingClientRect()
        if (rect) setHint(e.clientY - rect.top < rect.height / 2 ? 'before' : 'after')
      }}
      onDragLeave={() => setHint(null)}
      onDrop={(e) => {
        e.preventDefault()
        if (draggingRef.current && draggingRef.current !== id) {
          const rect = ref.current?.getBoundingClientRect()
          const pos = rect && e.clientY - rect.top >= rect.height / 2 ? 'after' : 'before'
          onReorder(draggingRef.current, id, pos)
        }
        draggingRef.current = null
        setHint(null)
      }}
    >
      <button
        type="button"
        aria-label={`拖拽调整「${label}」位置`}
        title="拖动调整模块位置"
        className="absolute -left-6 top-0 z-10 flex h-5 w-5 cursor-grab items-center justify-center rounded text-[var(--text-tertiary)] opacity-0 transition-opacity hover:bg-[var(--paper-accent-soft)] hover:text-[var(--paper-accent)] focus:opacity-100 active:cursor-grabbing group-hover/blk:opacity-100 print:hidden"
        onMouseDown={() => setArmed(true)}
        onMouseUp={() => setArmed(false)}
      >
        <GripIcon />
      </button>
      {hint === 'before' && <span className="absolute -top-[7px] left-0 right-0 z-10 h-[2px] rounded bg-[var(--paper-accent)]" />}
      {hint === 'after' && <span className="absolute -bottom-[7px] left-0 right-0 z-10 h-[2px] rounded bg-[var(--paper-accent)]" />}
      {children}
    </div>
  )
}

export default function ResumePaper({ data, template, highlight, print, styleOverride, onPagesChange, externalPages, order, onReorder, onBlocksChange, onEditRequest, onRenameTitle }: ResumePaperProps) {
  const draggingRef = useRef<string | null>(null)
  /* ---- 解析最终生效的主题色 / 装饰（自定义 > 模板默认） ---- */
  const customAccent = styleOverride?.accent
  const accent = customAccent || template.accent
  const soft = customAccent ? `color-mix(in srgb, ${accent} 10%, white)` : template.accentSoft
  const deco = !styleOverride || styleOverride.decoration === 'auto' ? (template.decoration ?? 'none') : styleOverride.decoration
  const nameArt = nameStyleCss(styleOverride?.nameStyle ?? 'plain')

  /* 深色纸张：整页深底 + 浅色文字（在纸张根节点覆盖全局文字令牌） */
  const isDarkPaper = !!template.paperDark
  const darkPaperBg = '#26241f'
  const paperVars = isDarkPaper
    ? ({
        '--paper-accent': accent,
        '--paper-accent-soft': `color-mix(in srgb, ${accent} 30%, ${darkPaperBg})`,
        // 经历卡片底色：深色纸张上用一层极淡的白色叠加，保持卡片可辨识但不泛白
        '--paper-card': 'rgba(255,255,255,0.055)',
        '--text-primary': '#f2f1ed',
        '--text-dark': '#dddcd6',
        '--text-body': '#c9c7c0',
        '--text-secondary': '#a8a69e',
        '--text-tertiary': '#8b897f',
        '--border-subtle': 'rgba(255,255,255,0.14)',
        '--paper-hl': 'rgba(232,184,75,0.38)',
        backgroundColor: darkPaperBg,
      } as CSSProperties)
    : ({
        '--paper-accent': accent,
        '--paper-accent-soft': soft,
        // 经历卡片底色：主题色 6% 混白，既能与模板主题呼应，又不会盖过正文
        '--paper-card': `color-mix(in srgb, ${accent} 6%, white)`,
      } as CSSProperties)

  const paperBase = `resume-paper ${template.rail ? 'border-l-[6px] border-[var(--paper-accent)]' : ''} isolate relative flex h-[792px] w-[560px] overflow-hidden rounded-[4px] ${
    isDarkPaper ? '' : 'bg-white'
  } ${print ? '' : 'shadow-[0_2px_4px_rgba(15,20,25,0.05),0_16px_32px_rgba(15,20,25,0.09),0_40px_80px_rgba(15,20,25,0.12)]'}`

  const isSidebar = template.layout === 'sidebar'
  const isTimeline = template.layout === 'timeline'
  const band = !!template.headerBand

  /* ---------- 顶部信息（单栏类版式共用；dark = 深色页眉带） ---------- */
  const headerRow = (dark?: boolean) => {
    // 城市/年限：未编辑时用默认演示值；用户清空后不再显示
    const cityYears = [data.city ?? '上海', data.years ?? '5 年经验'].filter(Boolean).join(' · ')
    return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-3.5">
        <h1
          className={`${template.paperFontClass} text-[24.5px] font-semibold ${dark ? 'text-white' : 'text-[var(--text-primary)]'} ${pulse('name', highlight)}`}
          style={nameArt}
        >
          {data.name}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10.5px] ${dark ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>求职意向</span>
          <span
            className={`rounded-[3px] px-[5px] py-px text-[11px] font-medium ${
              dark ? 'bg-white/20 text-white' : 'bg-[var(--paper-hl)] text-[var(--text-primary)]'
            } ${pulse('intent', highlight)}`}
          >
            {data.intent}
          </span>
        </div>
        <p className={`text-[10px] ${dark ? 'text-white/80' : 'text-[var(--text-secondary)]'} ${pulse('contact', highlight)}`}>
          {template.icons ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className={dark ? 'text-white/60' : 'text-[var(--paper-accent)]'}><PaperIcon kind="phone" size={11} /></span>
                {data.phone || '138-0011-2233'}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className={dark ? 'text-white/60' : 'text-[var(--paper-accent)]'}><PaperIcon kind="mail" size={11} /></span>
                {data.email || 'hi@lizhiyuan.com'}
              </span>
              {cityYears && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className={dark ? 'text-white/60' : 'text-[var(--paper-accent)]'}><PaperIcon kind="pin" size={11} /></span>
                  {cityYears}
                </span>
              )}
            </span>
          ) : (
            <>{[data.phone || '138-0011-2233', data.email || 'hi@lizhiyuan.com', cityYears].filter(Boolean).join('　·　')}</>
          )}
        </p>
      </div>
      <PaperAvatar data={data} size="h-[88px] w-[63px]" dark={dark} highlight={highlight} />
    </div>
    )
  }

  /* ---------- 宋体公文风页眉（kvHeader）：照片居左 + 姓名/意向 + KV 信息栅格 ---------- */
  const docerHeader = () => {
    const kv = (label: string, value: string, key: string, span?: boolean) => (
      <span className={`flex items-baseline gap-1 truncate px-2.5 py-[5px] ${span ? 'col-span-2' : ''}`}>
        <span className="shrink-0 text-[9.5px] text-[var(--text-tertiary)]">{label}</span>
        <span className={`truncate text-[10px] text-[var(--text-body)] ${pulse(key, highlight)}`}>{value || '—'}</span>
      </span>
    )
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-4">
          <PaperAvatar data={data} size="h-[84px] w-[60px]" highlight={highlight} />
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <h1
              className={`${template.paperFontClass} border-b-[1.5px] border-[var(--text-primary)] pb-0.5 text-[25.5px] font-bold leading-tight text-[var(--text-primary)] ${pulse('name', highlight)}`}
              style={nameArt}
            >
              {data.name}
            </h1>
            <p className={`text-[10.5px] text-[var(--text-body)] ${pulse('intent', highlight)}`}>
              <span className="text-[var(--text-tertiary)]">求职意向：</span>
              {data.intent}
            </p>
          </div>
        </div>
        {/* KV 信息栅格：细灰线分格（城市/年限/手机 · 邮箱/毕业院校） */}
        <div className={`grid grid-cols-3 divide-x divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] ${pulse('contact', highlight)}`}>
          {kv('所在城市', data.city ?? '', 'city')}
          {kv('工作年限', data.years ?? '', 'years')}
          {kv('手机', data.phone || '138-0011-2233', 'phone')}
          {kv('邮箱', data.email || 'hi@lizhiyuan.com', 'email')}
          {kv('毕业院校', data.school, 'school', true)}
        </div>
        <div className="h-[2px] w-full bg-[var(--paper-accent)]" />
      </div>
    )
  }

/* ---------- 单条工作经历行（时间轴版式用：整段不可拆） ---------- */
/** 「核心职责：」标签独行 + 职责条目小缩进列表（文档式） */
const dutyList = (lines: string[], pulseCls = ''): ReactNode => (
  <>
    {lines.length > 0 && (
      <div className={`${cardBodyCls} pt-[3px] ${pulseCls}`}>
        <span className={kvLabelCls}>核心职责：</span>
      </div>
    )}
    {lines.map((l, k) => (
      <div key={k} className={`${cardBodyCls} ${DUTY_INDENT}`}>
        {renderDescLine(l, '')}
      </div>
    ))}
  </>
)

/** 中文序号（项目一 / 项目二 …），超出拾位后回退阿拉伯数字 */
const CN_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const projOrdinal = (i: number) => `项目${CN_ORDINALS[i] ?? i + 1}`

/** 去掉项目名里已有的「项目一：」序号前缀（导入时已剥离则原样返回），避免与纸张统一编号重复 */
const stripProjOrd = (name: string) =>
  name.replace(/^(?:项目|案例|课题|产品)\s*[一二三四五六七八九十百\d]{1,3}\s*[:：、.]\s*/, '')

/** 项目头行：加粗项目名 + 右侧时间（无徽标、无底色） */
const projHead = (name: string, period: string, nameKey: string, periodKey: string) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className={`min-w-0 text-[11px] font-semibold leading-[16px] text-[var(--text-primary)] ${pulse(nameKey, highlight)}`}>{name}</span>
    {period && <span className={`shrink-0 text-[9px] leading-[16px] tabular-nums text-[var(--text-tertiary)] ${pulse(periodKey, highlight)}`}>{period}</span>}
  </div>
)

const jobRow = (job: ResumeData['jobs'][number], i: number, timeline: boolean) => {
  const duties = (job.duties ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const descLines = job.desc.split('\n').map((l) => l.trim()).filter(Boolean)
  const nested = job.projects ?? []
  const projLike = !!job.name && job.name !== job.company
  const head = projLike ? (job.name as string) : [job.company, job.role].filter(Boolean).join(' · ')
  const sub = projLike ? [job.role, job.company].filter(Boolean).join(' · ') : ''
  const hasOwn = !!(job.tech || descLines.length > 0 || duties.length > 0 || job.result)

  return (
    <div key={i} className="relative flex flex-col gap-[6px]">
      {timeline && (
        <span className="absolute -left-5 top-[5px] h-[9px] w-[9px] rounded-full border-2 border-[var(--paper-accent)] bg-white" />
      )}
      {/* 公司头行：公司 · 职位 + 时间 */}
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`min-w-0 text-[11.5px] font-semibold leading-[18px] text-[var(--text-primary)] ${
              pulse(projLike ? `jobs.${i}.name` : `jobs.${i}.company`, highlight)
            }`}
          >
            {head}
          </span>
          <span className={`shrink-0 text-[9.5px] tabular-nums text-[var(--text-tertiary)] ${pulse(`jobs.${i}.period`, highlight)}`}>
            {job.period}
          </span>
        </div>
        {sub && <span className={`text-[9.5px] leading-[14px] text-[var(--text-tertiary)] ${pulse(`jobs.${i}.role`, highlight)}`}>{sub}</span>}
      </div>

      {/* 经历自身内容（无嵌套项目时即整条经历） */}
      {hasOwn && (
        <div className="flex flex-col">
          {job.tech &&
            renderKvLine(
              '技术栈',
              <span className="text-[9.5px] leading-[15px]">{renderRich(job.tech)}</span>,
              pulse(`jobs.${i}.tech`, highlight),
            )}
          {descLines.map((l, k) =>
            k === 0 ? renderLabeledDesc('项目描述', l, pulse(`jobs.${i}.desc`, highlight)) : renderDescLine(l, cardBodyCls),
          )}
          {dutyList(duties)}
          {job.result && renderKvLine('项目成果', renderRich(joinPoints(job.result)), 'pt-[3px]')}
        </div>
      )}

      {/* 嵌套项目：文档式平铺（项目名做小标题，字段标签接排） */}
      {nested.map((p, j) => {
        const pk = `jobs.${i}.projects.${j}`
        const pd = (p.duties ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
        const pDesc = p.desc.split('\n').map((l) => l.trim()).filter(Boolean)
        return (
          <div key={j} className={`flex flex-col${j > 0 ? ' pt-[9px]' : ' pt-[3px]'}`}>
            {projHead(`${projOrdinal(j)}：${stripProjOrd(p.name) || '待补充项目'}`, p.period, `${pk}.name`, `${pk}.period`)}
            {p.role && (
              <p className={cardBodyCls}>
                <span className={kvLabelCls}>角色：</span>
                {p.role}
              </p>
            )}
            {p.tech &&
              renderKvLine('技术栈', <span className="text-[9.5px] leading-[15px]">{renderRich(p.tech)}</span>, pulse(`${pk}.tech`, highlight))}
            {pDesc.map((l, k) =>
              k === 0 ? renderLabeledDesc('项目描述', l, pulse(`${pk}.desc`, highlight)) : renderDescLine(l, cardBodyCls),
            )}
            {dutyList(pd, pulse(`${pk}.duties`, highlight))}
            {p.result && renderKvLine('项目成果', renderRich(joinPoints(p.result)), `pt-[3px] ${pulse(`${pk}.result`, highlight)}`)}
          </div>
        )
      })}
    </div>
  )
}

  /** 区块标题：优先用户自定义名称（titles 覆盖默认） */
  const secName = (key: SectionTitleKey) => data.titles?.[key]?.trim() || SECTION_TITLE_DEFAULTS[key]
  /** 可编辑标题的公共 props（打印副本不可编辑） */
  const titleProps = (key: SectionTitleKey) => ({
    title: secName(key),
    titleKey: key,
    onRenameTitle: print ? undefined : onRenameTitle,
  })

  const jobsTitle = <SecTitle template={template} highlight={highlight} {...titleProps('jobs')} />
  const projTitle = <SecTitle template={template} highlight={highlight} {...titleProps('projects')} />

  /* ---------- 教育背景 ---------- */
  /** 学校 / 专业学历拆分：eduMajor 优先，否则从「同济大学 · 软件工程（本科）」里按分隔符拆出 */
  const eduParts = (() => {
    const major = (data.eduMajor ?? '').trim()
    if (major) return { school: data.school.trim(), major }
    const i = data.school.search(/[·・｜|]/)
    if (i < 0) return { school: data.school.trim(), major: '' }
    return { school: data.school.slice(0, i).trim(), major: data.school.slice(i + 1).trim() }
  })()
  const eduBlock = (
    <div className="flex flex-col gap-2">
      <SecTitle template={template} highlight={highlight} {...titleProps('edu')} />
      <div className="flex items-baseline gap-2">
        <span className={`min-w-0 flex-1 text-[11px] font-semibold leading-[17px] text-[var(--text-primary)] ${pulse('school', highlight)}`}>
          {eduParts.school}
        </span>
        {eduParts.major && (
          <span className="shrink-0 text-[10px] leading-[17px] text-[var(--text-secondary)]">{eduParts.major}</span>
        )}
        <span className={`min-w-0 flex-1 text-right text-[9.5px] leading-[17px] tabular-nums text-[var(--text-tertiary)] ${pulse('eduPeriod', highlight)}`}>
          {data.eduPeriod}
        </span>
      </div>
    </div>
  )

  /* ---------- 技能特长：标签（默认）或进度条 ---------- */
  const skillPct = (s: string) => 62 + ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 34)
  const skillsBlock =
    template.skillsStyle === 'bars' ? (
      <div className="flex flex-col gap-2">
        <SecTitle template={template} highlight={highlight} {...titleProps('skills')} />
        <div className={`flex flex-col gap-[7px] ${pulse('skills', highlight)}`}>
          {data.skills.filter(Boolean).slice(0, 6).map((skill, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-body)]">{skill}</span>
                <span className="text-[9px] text-[var(--text-tertiary)]">{skillPct(skill)}%</span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full bg-[var(--paper-accent-soft)]">
                <div className="h-full rounded-full bg-[var(--paper-accent)]" style={{ width: `${skillPct(skill)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      // 文字形式：一行一条，统一编号（条目自带的序号会被剥离，避免出现两重序号）
      <div className="flex flex-col gap-2">
        <SecTitle template={template} highlight={highlight} {...titleProps('skills')} />
        <div className={`flex flex-col gap-[4px] ${pulse('skills', highlight)}`}>
          {data.skills.filter(Boolean).map((skill, i) => (
            <p key={i} className="flex gap-1.5 text-[10px] leading-[17px] text-[var(--text-body)]">
              <span className="w-[1.3em] shrink-0 text-right font-medium tabular-nums text-[var(--paper-accent)]">{i + 1}.</span>
              <span className="min-w-0 flex-1">{renderRich(stripSkillOrdinal(skill))}</span>
            </p>
          ))}
        </div>
      </div>
    )

  /* ---------- 自我评价 ---------- */
  const summaryBlock = (
    <div className="flex flex-col gap-2">
      <SecTitle template={template} highlight={highlight} {...titleProps('summary')} />
      {data.summary.split('\n').map((l) => l.trim()).filter(Boolean).map((l) =>
        renderDescLine(l, `text-[10px] leading-[17px] text-[var(--text-body)] ${pulse('summary', highlight)}`),
      )}
    </div>
  )

  /* ================= 内容区块拆分（用于分页测量） ================= */
  const blocks = useMemo<Block[]>(() => {
    const nameBlock = (
      <>
        <h1
          className={`${template.paperFontClass} text-[24.5px] font-semibold text-[var(--text-primary)] ${pulse('name', highlight)}`}
          style={nameArt}
        >
          {data.name}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-[var(--text-tertiary)]">求职意向</span>
          <span className={`rounded-[3px] bg-[var(--paper-hl)] px-[5px] py-px text-[11px] font-medium text-[var(--text-primary)] ${pulse('intent', highlight)}`}>
            {data.intent}
          </span>
        </div>
        <div className="h-px w-full bg-[var(--border-subtle)]" />
      </>
    )

    const list: Block[] = []

    if (isSidebar) {
      list.push({ id: 'name', node: nameBlock })
    } else {
      list.push({
        id: 'header',
        node: band ? (
          // 页眉色带：支持渐变（headerGradient）/ 深色（headerDark）/ 浅色三种
          <div
            className={`-mx-12 flex flex-col gap-3.5 px-12 pb-4 pt-[44px] ${
              template.headerGradient ? '' : template.headerDark ? 'bg-[var(--paper-accent)]' : 'bg-[var(--paper-accent-soft)]'
            }`}
            style={
              template.headerGradient
                ? { background: `linear-gradient(120deg, ${template.headerGradient[0]}, ${template.headerGradient[1]})` }
                : undefined
            }
          >
            {headerRow(template.headerDark || !!template.headerGradient)}
          </div>
        ) : template.kvHeader ? (
          docerHeader()
        ) : (
          <>
            {headerRow(false)}
            <div className="h-px w-full bg-[var(--border-subtle)]" />
          </>
        ),
      })
    }

    const projects = data.projects ?? []

    /**
     * 追加一条经历 / 项目（分页版）。
     *
     * 文档式平铺版式（无卡片底色与徽标）：首块「加粗项目名 + 右侧时间」，
     * 其后依次为 角色 / 技术栈 / 项目描述 / 核心职责 / 项目成果 的「标签：内容」行。
     * 每个字段行是独立分段块，跨页可拆；首块与其后的首条内容绑定为原子块，避免标题孤行。
     *
     * titleNode：区块大标题（只挂在第一条的首块之前，位于条目之外）。
     */
    const pushCard = (
      list: Block[],
      idPrefix: string,
      keys: { head: string; period?: string; role?: string; tech?: string; desc: string; result?: string },
      d: { head: string; period?: string; role?: string; tech?: string; desc: string; duties?: string; result?: string },
      opts?: { ordPrefix?: string; gap?: boolean; titleNode?: ReactNode },
    ) => {
      const descLines = d.desc.split('\n').map((l) => l.trim()).filter(Boolean)
      const dutyLines = (d.duties ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
      const rows: Array<{ id: string; node: ReactNode }> = []

      /* 首块：加粗标题 + 右侧时间 +（角色行，与标题绑定不拆分）；gap = 与上一项目之间的呼吸间隙 */
      rows.push({
        id: idPrefix,
        node: (
          <div className={`flex flex-col gap-[2px]${opts?.gap ? ' pt-[9px]' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`min-w-0 text-[11px] font-semibold leading-[16px] text-[var(--text-primary)] ${pulse(keys.head, highlight)}`}
              >
                {opts?.ordPrefix ? `${opts.ordPrefix}：${d.head}` : d.head}
              </span>
              {d.period && (
                <span
                  className={`shrink-0 text-[9px] leading-[16px] tabular-nums text-[var(--text-tertiary)] ${
                    keys.period ? pulse(keys.period, highlight) : ''
                  }`}
                >
                  {d.period}
                </span>
              )}
            </div>
            {d.role && (
              <div className={`${cardBodyCls} ${keys.role ? pulse(keys.role, highlight) : ''}`}>
                <span className={kvLabelCls}>角色：</span>
                {d.role}
              </div>
            )}
          </div>
        ),
      })

      /* 技术栈 */
      if (d.tech) {
        rows.push({
          id: `${idPrefix}:t`,
          node: renderKvLine('技术栈', <span className="text-[9.5px] leading-[15px]">{renderRich(d.tech)}</span>, keys.tech ? pulse(keys.tech, highlight) : ''),
        })
      }

      /* 项目描述：标签与首行接排；每行一个区块，跨页可拆 */
      descLines.forEach((line, k) => {
        rows.push({
          id: `${idPrefix}:d${k}`,
          node:
            k === 0
              ? renderLabeledDesc('项目描述', line, pulse(keys.desc, highlight))
              : renderDescLine(line, cardBodyCls),
        })
      })

      /* 核心职责：标签独行，条目统一小缩进列表 */
      if (dutyLines.length > 0) {
        rows.push({
          id: `${idPrefix}:y0`,
          node: (
            <div className={`${cardBodyCls} pt-[3px]`}>
              <span className={kvLabelCls}>核心职责：</span>
            </div>
          ),
        })
        dutyLines.forEach((line, k) => {
          rows.push({
            id: `${idPrefix}:y${k + 1}`,
            node: (
              <div className={`${cardBodyCls} ${DUTY_INDENT}`}>{renderDescLine(line, '')}</div>
            ),
          })
        })
      }

      /* 项目成果 */
      if (d.result) {
        rows.push({
          id: `${idPrefix}:r`,
          node: renderKvLine('项目成果', renderRich(joinPoints(d.result)), `pt-[3px] ${keys.result ? pulse(keys.result, highlight) : ''}`),
        })
      }

      /* 逐块平铺输出：无卡片外壳；区块标题只挂在第一条之前 */
      rows.forEach((r, k) => {
        list.push({
          id: r.id,
          node:
            k === 0 && opts?.titleNode ? (
              <div className="flex flex-col">
                <div className="pb-2">{opts.titleNode}</div>
                {r.node}
              </div>
            ) : (
              r.node
            ),
        })
      })
    }

    /**
     * 追加一个经历类模块。两种结构：
     * - 条目下挂了多个项目（一条工作经历带多个项目）→ 公司头行 + 每个项目一张卡片（带序号徽标）；
     * - 条目本身就是一段经历 / 一个项目 → 整条渲染为一张卡片。
     */
    const pushEntries = (
      list: Block[],
      prefix: string,
      titleNode: ReactNode,
      entries: Array<{
        head: string
        period: string
        desc: string
        tech?: string
        role?: string
        duties?: string
        result?: string
        projects?: JobProject[]
        headKey: string
        periodKey: string
        roleKey: string
        techKey: string
        descKey: string
        resultKey: string
      }>,
    ) => {
      entries.forEach((en, i) => {
        const idPrefix = `${prefix}-${i}`
        const nested = en.projects ?? []

        if (nested.length > 0) {
          /* 公司头行：公司 · 职位 + 时间（项目名称一律放在下面的卡片里，不与公司混排） */
          list.push({
            id: idPrefix,
            node: (
              <div className="flex flex-col gap-[4px]">
                {i === 0 && <div className="pb-0.5">{titleNode}</div>}
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`min-w-0 text-[11.5px] font-semibold leading-[18px] text-[var(--text-primary)] ${pulse(en.headKey, highlight)}`}
                  >
                    {en.head}
                  </span>
                  {en.period && (
                    <span className={`shrink-0 text-[9.5px] tabular-nums text-[var(--text-tertiary)] ${pulse(en.periodKey, highlight)}`}>
                      {en.period}
                    </span>
                  )}
                </div>
                <div className="h-px w-full bg-[var(--border-subtle)]" />
              </div>
            ),
          })
          nested.forEach((p, j) => {
            const base = `${prefix}.${i}.projects.${j}`
            pushCard(
              list,
              `${idPrefix}:p${j}`,
              {
                head: `${base}.name`,
                period: `${base}.period`,
                role: `${base}.role`,
                tech: `${base}.tech`,
                desc: `${base}.desc`,
                result: `${base}.result`,
              },
              {
                head: stripProjOrd(p.name) || '待补充项目',
                period: p.period,
                role: p.role,
                tech: p.tech,
                desc: p.desc,
                duties: p.duties,
                result: p.result,
              },
              { ordPrefix: projOrdinal(j), gap: j > 0 },
            )
          })
        } else {
          pushCard(
            list,
            idPrefix,
            {
              head: en.headKey,
              period: en.periodKey,
              role: en.roleKey,
              tech: en.techKey,
              desc: en.descKey,
              result: en.resultKey,
            },
            { head: en.head, period: en.period, role: en.role, tech: en.tech, desc: en.desc, duties: en.duties, result: en.result },
            { titleNode: i === 0 ? titleNode : undefined },
          )
        }
      })
    }

    if (isTimeline) {
      // 时间轴版式：竖线贯穿整组，作为单一区块；技能默认置顶
      list.push({ id: 'skills', node: skillsBlock })
      list.push({
        id: 'jobs',
        node: (
          <div className="flex flex-col gap-2">
            {jobsTitle}
            <div className="relative ml-2 flex flex-col gap-3 pl-5">
              <span className="absolute bottom-[7px] left-0 top-[7px] w-px bg-[var(--paper-accent)] opacity-30" />
              {data.jobs.map((job, i) => jobRow(job, i, true))}
            </div>
          </div>
        ),
      })
      pushEntries(
        list,
        'proj',
        projTitle,
        projects.map((p, i) => ({
          head: p.name,
          period: p.period,
          desc: p.desc,
          role: p.role,
          tech: p.tech,
          duties: p.duties,
          result: p.result,
          headKey: `projects.${i}.name`,
          periodKey: `projects.${i}.period`,
          roleKey: `projects.${i}.role`,
          techKey: `projects.${i}.tech`,
          descKey: `projects.${i}.desc`,
          resultKey: `projects.${i}.result`,
        })),
      )
    } else {
      if (template.layout === 'edu-first') {
        // 应届生版式：教育背景优先，其次技能
        list.push({ id: 'edu', node: eduBlock })
        list.push({ id: 'skills', node: skillsBlock })
      } else {
        // 默认：技能特长第一项（紧跟页眉）
        list.push({ id: 'skills', node: skillsBlock })
      }
      pushEntries(
        list,
        'job',
        jobsTitle,
        data.jobs.map((job, i) => {
          // 项目制写法（有项目名称）→ 项目名领衔，公司 / 角色退为副标题；
          // 普通写法 → 头行即「公司 · 职位」，不再有副标题。
          const projLike = !!job.name && job.name !== job.company
          return {
            head: projLike ? (job.name as string) : [job.company, job.role].filter(Boolean).join(' · '),
            period: job.period,
            role: projLike ? [job.role, job.company].filter(Boolean).join(' · ') : undefined,
            tech: job.tech,
            desc: job.desc,
            duties: job.duties,
            result: job.result,
            projects: job.projects,
            headKey: projLike ? `jobs.${i}.name` : `jobs.${i}.company`,
            periodKey: `jobs.${i}.period`,
            roleKey: projLike ? `jobs.${i}.role` : `jobs.${i}.company`,
            techKey: `jobs.${i}.tech`,
            descKey: `jobs.${i}.desc`,
            resultKey: `jobs.${i}.result`,
          }
        }),
      )
      pushEntries(
        list,
        'proj',
        projTitle,
        projects.map((p, i) => ({
          head: p.name,
          period: p.period,
          desc: p.desc,
          role: p.role,
          tech: p.tech,
          duties: p.duties,
          result: p.result,
          headKey: `projects.${i}.name`,
          periodKey: `projects.${i}.period`,
          roleKey: `projects.${i}.role`,
          techKey: `projects.${i}.tech`,
          descKey: `projects.${i}.desc`,
          resultKey: `projects.${i}.result`,
        })),
      )
      if (template.layout !== 'edu-first') list.push({ id: 'edu', node: eduBlock })
    }

    if (isSidebar) {
      list.push({ id: 'summary', node: summaryBlock })
    } else {
      // 技能已在前面置顶（edu-first 版式亦同），这里只补自我评价
      list.push({ id: 'summary', node: summaryBlock })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, template, highlight, styleOverride, isSidebar, isTimeline, band])

  /* ---- 逻辑区块（拖拽排序单位）：经历的描述续块归属其头行，整条一起移动 ---- */
  const logicalBlocks = useMemo(() => {
    const out: Array<{ id: string; blocks: Block[] }> = []
    for (const b of blocks) {
      if (isDescCont(b.id)) {
        const head = out[out.length - 1]
        if (head && head.id === b.id.split(':')[0]) head.blocks.push(b)
      } else {
        out.push({ id: b.id, blocks: [b] })
      }
    }
    return out
  }, [blocks])

  /* ---- 应用自定义排序（拖拽结果）；未覆盖到的区块（如新增经历）追加到末尾 ---- */
  const orderedLogical = useMemo(() => {
    if (!order || order.length === 0) return logicalBlocks
    const map = new Map(logicalBlocks.map((l) => [l.id, l]))
    const out: typeof logicalBlocks = []
    for (const id of order) {
      const l = map.get(id)
      if (l) {
        out.push(l)
        map.delete(id)
      }
    }
    for (const l of map.values()) out.push(l)
    return out
  }, [logicalBlocks, order])

  const orderedBlocks = useMemo(() => orderedLogical.flatMap((l) => l.blocks), [orderedLogical])

  /* ================= 分页：实测每个区块高度，按页容量分组 ================= */
  const measureRef = useRef<HTMLDivElement | null>(null)
  // 分页状态只存「区块 id 分组」，渲染时再实时解析节点——避免缓存旧节点导致纸张不随编辑刷新
  const [pages, setPages] = useState<string[][] | null>(null)
  const [fontTick, setFontTick] = useState(0)

  // 字体异步加载完成后高度会变，需重新测量
  useEffect(() => {
    document.fonts?.ready.then(() => setFontTick((t) => t + 1))
  }, [])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    // 预览容器可能有缩放（窗口窄时自动适配 / 用户手动缩放），getBoundingClientRect 返回的是
    // 缩放后的视觉尺寸；分页必须用真实布局高度，用「视觉宽 / 布局宽」比值求缩放系数还原
    const baseWidth = isSidebar ? 300 : 464
    const zoomFactor = el.getBoundingClientRect().width / baseWidth || 1
    const heights = Array.from(el.children).map((c) => (c as HTMLElement).getBoundingClientRect().height / zoomFactor)
    // 首页容量：带页眉带/双栏布局时上内边距由区块内部承担
    const capFirst = isSidebar ? PAGE_H - SIDEBAR_PAD_Y * 2 : band ? PAGE_H - PAD_Y : PAGE_H - PAD_Y * 2
    const capRest = isSidebar ? PAGE_H - SIDEBAR_PAD_Y * 2 : PAGE_H - PAD_Y * 2
    // 区块间距已烘焙进各区块（标准块 pt-3.5），行间不再叠加间距
    const cap = () => (grouped.length === 0 ? capFirst : capRest)

    const grouped: string[][] = []
    let cur: string[] = []
    let used = 0
    for (let i = 0; i < orderedBlocks.length; i++) {
      const h = heights[i] ?? 0
      const b = orderedBlocks[i]
      // 经历头行与其第一条描述不拆开（避免页底留下孤零零的标题）
      const next = orderedBlocks[i + 1]
      // 卡片 / 经历头行与其紧邻的第一条内容绑在一起，避免页尾只留一个孤零零的标题
      // （`job-0` → `job-0:p0` 是公司行与首张卡片，`job-0:p0` → `job-0:p0:t` 是卡片首块与首个字段）
      const tied = !!next && (isDescCont(next.id) || next.id.startsWith(`${b.id}:`))
      const atomicH = next && isEntryHead(b.id) && tied ? (heights[i + 1] ?? 0) : 0
      if (cur.length > 0 && used + h + atomicH > cap()) {
        grouped.push(cur)
        cur = []
        used = 0
      }
      cur.push(b.id)
      used += h
      if (next && atomicH) {
        cur.push(next.id)
        used += atomicH
        i++
      }
    }
    if (cur.length > 0) grouped.push(cur)
    const result = grouped.length > 0 ? grouped : [orderedBlocks.map((b) => b.id)]

    setPages((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result))
  }, [orderedBlocks, isSidebar, band, fontTick, externalPages])

  /* 把 id 分组解析回区块节点（屏幕分页与打印共享分页都走这里，节点始终取最新渲染） */
  const nodeMap = useMemo(() => new Map<string, Block>(orderedBlocks.map((b) => [b.id, b] as [string, Block])), [orderedBlocks])
  const resolveGroups = useCallback(
    (groups: string[][]) => groups.map((g) => g.map((id) => nodeMap.get(id)).filter((b): b is Block => !!b)),
    [nodeMap],
  )
  const resolvedExternal = useMemo(() => (externalPages ? resolveGroups(externalPages) : null), [externalPages, resolveGroups])
  const resolvedPages = useMemo(() => (pages ? resolveGroups(pages) : null), [pages, resolveGroups])
  const pageGroups = resolvedExternal ?? resolvedPages

  /* 分页结果上抛：签名去重，避免相同分页反复触发上级 setState 造成死循环 */
  const lastPagesSigRef = useRef<string | null>(null)
  useEffect(() => {
    if (externalPages) return
    if (!pageGroups) return
    const sig = JSON.stringify(pageGroups.map((p) => p.map((b) => b.id)))
    if (lastPagesSigRef.current === sig) return
    lastPagesSigRef.current = sig
    onPagesChange?.(pageGroups.map((p) => p.map((b) => b.id)))
  }, [pageGroups, externalPages, onPagesChange])

  // 区块 id 列表上抛（App 的拖拽排序需要完整的默认顺序；逻辑单位 = 经历头行）
  useEffect(() => {
    if (externalPages) return
    onBlocksChange?.(orderedLogical.map((l) => l.id))
  }, [orderedLogical, externalPages, onBlocksChange])

  /* ---------- 页面渲染 ---------- */
  const BLOCK_LABELS: Record<string, string> = {
    header: '个人信息',
    name: '个人信息',
    jobs: '工作经历',
    edu: '教育背景',
    skills: '技能特长',
    summary: '自我评价',
  }
  const blockLabel = (id: string) =>
    BLOCK_LABELS[id] ?? (id.startsWith('job-') ? '工作经历' : id.startsWith('proj-') ? '项目经历' : id)

  /** 区块 id → 编辑面板模块（点击纸张内容直达对应编辑区） */
  const sectionOf = (id: string): 'personal' | 'jobs' | 'projects' | 'edu' | 'skills' | 'summary' => {
    if (id === 'header' || id === 'name') return 'personal'
    if (id === 'jobs' || id.startsWith('job-')) return 'jobs'
    if (id.startsWith('proj-')) return 'projects'
    if (id === 'edu') return 'edu'
    if (id === 'skills') return 'skills'
    return 'summary'
  }

  /** 页面内渲染一个区块：标准块非页首时带 pt-3.5 顶距（与测量一致），描述续块行距 0 */
  const renderBlock = (b: Block, gi: number, disableDrag: boolean) => {
    const inner = (
      <DraggableBlock
        id={b.id}
        label={blockLabel(b.id)}
        enabled={!print && !!onReorder && !disableDrag && !isDescCont(b.id)}
        contents={b.id === 'header'}
        draggingRef={draggingRef}
        onReorder={onReorder}
        onClick={!print && onEditRequest && !isDescCont(b.id) ? () => onEditRequest(sectionOf(b.id)) : undefined}
      >
        {b.node}
      </DraggableBlock>
    )
    if (gi > 0 && !isDescCont(b.id)) return <div key={b.id} className="pt-3.5">{inner}</div>
    return <div key={b.id}>{inner}</div>
  }

  const renderPage = (group: Block[], pi: number) => {
    if (isSidebar) {
      const dark = !!template.sidebarDark
      return (
        <div key={pi} className={paperBase} style={paperVars}>
          {pi === 0 && deco !== 'none' && <PaperDeco deco={deco} />}
          {pi === 0 ? (
            <aside
              className={`flex w-[188px] shrink-0 flex-col gap-5 px-7 py-10 ${dark ? 'bg-[var(--paper-accent)]' : 'bg-[var(--paper-accent-soft)]'}`}
            >
              <PaperAvatar data={data} size="h-[88px] w-[63px]" dark={dark} highlight={highlight} />
              <div className="flex flex-col gap-1.5">
                <span className={`inline-flex items-center gap-1 text-[9.5px] ${dark ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
                  {template.icons && <PaperIcon kind="phone" size={11} />}
                  电话
                </span>
                <span className={`text-[10px] ${dark ? 'text-white' : 'text-[var(--text-body)]'} ${pulse('phone', highlight)}`}>{data.phone || '138-0011-2233'}</span>
                <span className={`mt-1.5 inline-flex items-center gap-1 text-[9.5px] ${dark ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
                  {template.icons && <PaperIcon kind="mail" size={11} />}
                  邮箱
                </span>
                <span className={`break-all text-[10px] ${dark ? 'text-white' : 'text-[var(--text-body)]'} ${pulse('email', highlight)}`}>{data.email || 'hi@lizhiyuan.com'}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`text-[10.5px] font-semibold ${dark ? 'text-white' : 'text-[var(--text-primary)]'}`}>技能特长</span>
                <div className={`flex flex-col gap-[4px] ${pulse('skills', highlight)}`}>
                  {data.skills.filter(Boolean).map((skill, i) => (
                    <p key={i} className={`flex gap-1.5 text-[9.5px] leading-[15px] ${dark ? 'text-white/85' : 'text-[var(--text-body)]'}`}>
                      <span className={`w-[1.3em] shrink-0 text-right font-medium tabular-nums ${dark ? 'text-white/70' : 'text-[var(--paper-accent)]'}`}>
                        {i + 1}.
                      </span>
                      <span className="min-w-0 flex-1">{renderRich(stripSkillOrdinal(skill))}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`text-[10.5px] font-semibold ${dark ? 'text-white' : 'text-[var(--text-primary)]'}`}>教育背景</span>
                <span className={`text-[10px] leading-[15px] ${dark ? 'text-white' : 'text-[var(--text-body)]'} ${pulse('school', highlight)}`}>{eduParts.school}</span>
                {eduParts.major && (
                  <span className={`text-[9px] leading-[14px] ${dark ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>{eduParts.major}</span>
                )}
                <span className={`text-[9px] ${dark ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>{data.eduPeriod}</span>
              </div>
            </aside>
          ) : (
            // 后续页：延续侧栏色条，内容接排
            <aside className={`w-[188px] shrink-0 ${dark ? 'bg-[var(--paper-accent)]' : 'bg-[var(--paper-accent-soft)]'}`} />
          )}
          <main className="flex min-w-0 flex-1 flex-col px-9 py-10">
            {group.map((b, gi) => renderBlock(b, gi, b.id === 'name'))}
          </main>
        </div>
      )
    }

    const bandPage = band && pi === 0
    return (
      <div
        key={pi}
        className={`${paperBase} flex-col ${bandPage ? 'px-12 pb-[44px]' : 'px-12 py-[44px]'}`}
        style={paperVars}
      >
        {pi === 0 && deco !== 'none' && <PaperDeco deco={deco} />}
        {group.map((b, gi) => renderBlock(b, gi, b.id === 'header'))}
      </div>
    )
  }

  return (
    <>
      {/* 测量容器：屏幕不可见，仅用于实测区块高度（打印副本复用外部结果，无需测量）。
          通过 Portal 挂到 body：预览面板隐藏（移动端编辑视图）或缩放（自动适配）时
          依然能拿到真实的未缩放布局高度，分页才不会塌成一页。
          标准块带 pt-3.5 顶距（与页面渲染一致），描述续块行距 0（与段落内行高一致） */}
      {!externalPages &&
        createPortal(
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none fixed left-[-9999px] top-0 flex flex-col"
            style={{ width: isSidebar ? 300 : 464, visibility: 'hidden' }}
          >
            {orderedBlocks.map((b) => (
              <div key={b.id} className={isDescCont(b.id) ? undefined : 'pt-3.5'}>
                {b.node}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {/* 页面堆叠 */}
      <div className={`paper-stack ${print ? '' : 'flex flex-col gap-4'}`}>
        {(pageGroups ?? [orderedBlocks]).map((group, pi) => renderPage(group, pi))}
      </div>
    </>
  )
}
