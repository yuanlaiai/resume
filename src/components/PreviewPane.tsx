import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumeData, ResumeTemplate, StyleOverride } from '../types'
import ResumePaper from './ResumePaper'
import { CheckCircleIcon, MinusIcon, PlusIcon } from './icons'

interface PreviewPaneProps {
  data: ResumeData
  template: ResumeTemplate
  highlight: string | null
  styleOverride: StyleOverride
  /** 分页结果上抛（App 共享给打印副本） */
  onPagesChange?: (pages: string[][]) => void
  /** 自定义区块顺序（拖拽排序） */
  order?: string[] | null
  /** 拖拽排序回调 */
  onReorder?: (dragId: string, targetId: string, pos: 'before' | 'after') => void
  /** 区块 id 列表上抛 */
  onBlocksChange?: (ids: string[]) => void
  /** 恢复默认布局 */
  onResetOrder?: () => void
  /** 点击纸张区块 → 打开编辑面板对应模块 */
  onEditRequest?: (section: 'personal' | 'jobs' | 'projects' | 'edu' | 'skills' | 'summary') => void
  /** 修改区块标题名称（点击纸张标题直接编辑） */
  onRenameTitle?: (key: import('../types').SectionTitleKey, value: string) => void
}

export default function PreviewPane({ data, template, highlight, styleOverride, onPagesChange, order, onReorder, onBlocksChange, onResetOrder, onEditRequest, onRenameTitle }: PreviewPaneProps) {
  const [zoom, setZoom] = useState(100)
  const [pageCount, setPageCount] = useState(1)
  // 用户手动缩放后不再自动适配；未操作时按容器宽度自适应（手机端纸张缩小到屏内）
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const manualZoom = useRef(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const fit = () => {
      if (manualZoom.current) return
      const w = el.clientWidth - 24
      setZoom(w < 560 ? Math.max(50, Math.round((w / 560) * 100)) : 100)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const setManualZoom = (z: number) => {
    manualZoom.current = true
    setZoom(z)
  }
  // 稳定回调：避免每次渲染生成新函数，导致 ResumePaper 的上报 effect 死循环
  const handlePages = useCallback(
    (pages: string[][]) => {
      setPageCount(pages.length)
      onPagesChange?.(pages)
    },
    [onPagesChange],
  )

  return (
    <div className="relative min-w-0 flex-1 bg-[var(--bg-preview)]">
      {/* 可滚动预览区（多页简历时上下滚动） */}
      <div ref={scrollRef} className="absolute inset-0 flex flex-col overflow-auto">
        <div className="m-auto w-fit py-8" style={{ zoom: zoom / 100 }}>
          <ResumePaper
            data={data}
            template={template}
            highlight={highlight}
            styleOverride={styleOverride}
            onPagesChange={handlePages}
            order={order}
            onReorder={onReorder}
            onBlocksChange={onBlocksChange}
            onEditRequest={onEditRequest}
            onRenameTitle={onRenameTitle}
          />
        </div>
      </div>

      {/* 同步提示 Toast（编辑字段时出现，2 秒后消失） */}
      <div
        className={`absolute left-1/2 top-[30px] z-10 flex -translate-x-1/2 items-center gap-[7px] rounded-full bg-white px-3.5 py-[9px] shadow-[0_6px_20px_rgba(15,20,25,0.12)] transition-all duration-300 ${
          highlight ? 'opacity-100' : 'pointer-events-none -translate-y-1.5 opacity-0'
        }`}
      >
        <CheckCircleIcon className="h-[15px] w-[15px]" />
        <span className="text-xs font-medium text-[var(--text-dark)]">已同步至预览</span>
      </div>

      {/* 缩放工具条 */}
      <div className="absolute bottom-[14px] left-1/2 z-10 flex h-[38px] -translate-x-1/2 items-center gap-3.5 whitespace-nowrap rounded-full bg-white px-4 shadow-[0_6px_20px_rgba(15,20,25,0.12)]">
        <button
          type="button"
          onClick={() => setManualZoom(Math.max(60, zoom - 10))}
          className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="缩小"
        >
          <MinusIcon className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[44px] text-center text-xs font-medium text-[var(--text-dark)]">{zoom}%</span>
        <button
          type="button"
          onClick={() => setManualZoom(Math.min(140, zoom + 10))}
          className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="放大"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
        <span className="h-4 w-px bg-[var(--border-subtle)]" />
        <span className="text-xs text-[var(--text-tertiary)]">第 1 页 / 共 {pageCount} 页</span>
        {order && order.length > 0 && onResetOrder && (
          <>
            <span className="h-4 w-px bg-[var(--border-subtle)]" />
            <button
              type="button"
              onClick={onResetOrder}
              className="text-xs text-[var(--paper-accent,#4F8A82)] transition-colors hover:opacity-70"
              title="恢复模板默认的模块排布"
            >
              重置布局
            </button>
          </>
        )}
      </div>
    </div>
  )
}
