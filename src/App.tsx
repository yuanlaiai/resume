import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import EditorPanel from './components/EditorPanel'
import PreviewPane from './components/PreviewPane'
import ResumePaper from './components/ResumePaper'
import AiPanel from './components/AiPanel'
import { RESUME_TEMPLATES } from './data/templates'
import type { Job, JobProject, Project, ResumeData, StyleOverride, SectionTitleKey } from './types'
import { SECTION_TITLE_DEFAULTS } from './types'
import { CheckCircleIcon } from './components/icons'
import { extractResume, parseResumeText } from './lib/parseResume'
import { aiParseResume, aiCleanResumeText, loadApiKey } from './lib/deepseek'
import type { EditorSection } from './components/EditorPanel'

const BASE_DEMO = RESUME_TEMPLATES[0].demo

/** 将 "jobs.0.company" / "jobs.0.projects.1.name" / "projects.1.name" 形式的字段路径写入数据 */
function applyEdit(data: ResumeData, key: string, value: string): ResumeData {
  const parts = key.split('.')
  if (parts[0] === 'jobs') {
    const index = Number(parts[1])
    // jobs.N.projects.M.field —— 工作经历下的项目字段
    if (parts[2] === 'projects') {
      const pIndex = Number(parts[3])
      const pField = parts[4] as keyof JobProject
      return {
        ...data,
        jobs: data.jobs.map((job, i) =>
          i === index
            ? { ...job, projects: (job.projects ?? []).map((p, j) => (j === pIndex ? { ...p, [pField]: value } : p)) }
            : job,
        ),
      }
    }
    const field = parts[2] as keyof Job
    return {
      ...data,
      jobs: data.jobs.map((job, i) => (i === index ? { ...job, [field]: value } : job)),
    }
  }
  if (parts[0] === 'projects') {
    const index = Number(parts[1])
    const field = parts[2] as keyof Project
    const projects = data.projects ?? []
    return {
      ...data,
      projects: projects.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }
  }
  if (key === 'contact') return data
  return { ...data, [key]: value }
}

/** UTF-8 安全的 base64 编解码（用于分享链接数据） */
function b64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin)
}

function b64Decode(b64: string): string {
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** 复制文本到剪贴板，clipboard API 失败时降级为 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export default function App() {
  // 移动端单栏视图切换（桌面端双栏同时展示，此状态不生效）
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [templateId, setTemplateId] = useState('minimal')
  const template = RESUME_TEMPLATES.find((t) => t.id === templateId) ?? RESUME_TEMPLATES[0]

  const [data, setData] = useState<ResumeData>(BASE_DEMO)
  // 用户一旦手动编辑，切换模板就不再覆盖内容
  const [dirty, setDirty] = useState(false)

  // 自定义样式（主题色 / 姓名艺术字 / 装饰插画），叠加在任意模板之上
  const [styleOverride, setStyleOverride] = useState<StyleOverride>({ nameStyle: 'plain', decoration: 'auto' })

  // 分页结果：屏幕预览实例测量，打印副本复用（display:none 中无法自行测量）
  const [sharedPages, setSharedPages] = useState<string[][] | null>(null)

  // 纸张模块自定义排序（预览中拖拽调整），null = 模板默认顺序
  const [blockOrder, setBlockOrder] = useState<string[] | null>(null)
  const blockIdsRef = useRef<string[]>([])
  const handleBlocksChange = useCallback((ids: string[]) => {
    blockIdsRef.current = ids
  }, [])
  const handleReorder = useCallback((dragId: string, targetId: string, pos: 'before' | 'after') => {
    setBlockOrder((prev) => {
      const base = blockIdsRef.current
      if (base.length === 0) return prev
      // 以最新区块列表为准归一化：保留自定义顺序，新增区块追加末尾
      const cur = prev ? [...prev.filter((id) => base.includes(id)), ...base.filter((id) => !prev.includes(id))] : [...base]
      const from = cur.indexOf(dragId)
      if (from === -1 || dragId === targetId || !cur.includes(targetId)) return prev
      cur.splice(from, 1)
      const ti = cur.indexOf(targetId)
      cur.splice(pos === 'before' ? ti : ti + 1, 0, dragId)
      return cur
    })
  }, [])

  // 初始高亮「求职意向」，复现设计稿中的同步高亮演示状态
  const [highlight, setHighlight] = useState<string | null>('intent')
  const timer = useRef<number | undefined>(undefined)

  // 操作反馈 Toast（分享/头像/模板应用等）
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = (message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }

  // 点击纸张区块 → 编辑面板展开并滚动到对应模块（tick 用于重复点击同一区块时再次触发）
  const [focusSection, setFocusSection] = useState<{ key: EditorSection; tick: number } | null>(null)
  const handleEditRequest = useCallback((key: EditorSection) => {
    setMobileView('edit') // 手机端切回编辑视图
    setFocusSection((prev) => ({ key, tick: (prev?.tick ?? 0) + 1 }))
  }, [])

  // 点击纸张区块标题直接改名（Enter/失焦保存；改回默认名或清空则删除覆盖，保持数据干净）
  const handleRenameTitle = useCallback((key: SectionTitleKey, value: string) => {
    setData((prev) => {
      const v = value.trim()
      const titles = { ...prev.titles }
      if (!v || v === SECTION_TITLE_DEFAULTS[key]) delete titles[key]
      else titles[key] = v
      return { ...prev, titles }
    })
    setDirty(true)
  }, [])

  /* ---------- AI 助手（DeepSeek） ---------- */
  const [aiOpen, setAiOpen] = useState(false)
  // 对话范围：null = 全简历；从编辑模块的 AI 按钮进入时锁定该模块
  const [aiScope, setAiScope] = useState<EditorSection | null>(null)
  // AI 修改前的快照（支持一键撤销）
  const [aiPrev, setAiPrev] = useState<ResumeData | null>(null)
  const handleAskAi = useCallback((key: EditorSection) => {
    setAiScope(key)
    setAiOpen(true)
  }, [])
  const handleAiApply = (next: ResumeData, note: string) => {
    setAiPrev((p) => p ?? data)
    setDirty(true)
    setData(next)
    notify(note)
  }
  const handleAiApplySuggestion = (path: string, value: string) => {
    setAiPrev((p) => p ?? data)
    setDirty(true)
    setData((prev) => applyEdit(prev, path, value))
  }
  const handleAiUndo = () => {
    if (aiPrev) {
      setData(aiPrev)
      setAiPrev(null)
      notify('已还原到 AI 修改前')
    }
  }

  // 从分享链接载入简历（#d=base64(数据)）
  useEffect(() => {
    const match = window.location.hash.match(/#d=([A-Za-z0-9+/=]+)/)
    if (!match) return
    try {
      const parsed = JSON.parse(b64Decode(match[1])) as {
        t?: string
        d?: Partial<ResumeData>
        s?: Partial<StyleOverride>
        o?: string[]
      }
      let restored = false
      if (parsed.d) {
        setData({ ...BASE_DEMO, ...parsed.d })
        setDirty(true)
        restored = true
      }
      if (parsed.s) {
        setStyleOverride((prev) => ({ ...prev, ...parsed.s }))
        restored = true
      }
      if (Array.isArray(parsed.o) && parsed.o.length > 0) {
        setBlockOrder(parsed.o)
        restored = true
      }
      if (parsed.t && RESUME_TEMPLATES.some((t) => t.id === parsed.t)) {
        setTemplateId(parsed.t)
        restored = true
      }
      if (restored) notify('已载入分享的简历内容，可直接继续编辑')
    } catch {
      // 链接数据无效则忽略，使用默认内容
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setHighlight((k) => (k === 'intent' ? null : k)), 2600)
    return () => window.clearTimeout(t)
  }, [])

  const flash = (key: string) => {
    setHighlight(key)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHighlight(null), 2400)
  }

  const onEdit = (key: string, value: string) => {
    setDirty(true)
    setData((prev) => applyEdit(prev, key, value))
    flash(key)
  }

  /** 切换模板：未编辑过内容时，自动填入该模板对应职业的示例 */
  const selectTemplate = (id: string) => {
    setTemplateId(id)
    if (!dirty) {
      const t = RESUME_TEMPLATES.find((x) => x.id === id)
      if (t) {
        setData({ ...t.demo })
        notify(`已应用「${t.name}」职业示例，所有字段可直接修改替换`)
      }
    }
  }

  /** 分享链接：简历数据 + 模板 + 自定义样式编码进 URL，复制到剪贴板 */
  const handleShare = async () => {
    const payload = JSON.stringify({
      t: templateId,
      d: { ...data, avatar: undefined },
      s: styleOverride,
      ...(blockOrder && blockOrder.length > 0 ? { o: blockOrder } : {}),
    })
    const link = `${window.location.origin}${window.location.pathname}#d=${b64Encode(payload)}`
    const ok = await copyText(link)
    notify(
      ok
        ? '分享链接已复制，发给 TA 打开即可看到这份简历'
        : '复制失败，请手动复制浏览器地址栏链接',
    )
  }

  /** 下载 PDF：唤起系统打印，仅打印 A4 纸张副本（另存为 PDF） */
  const handlePrint = () => {
    window.print()
  }

  /** 导入本地 PDF/Word 简历：解析 → 自动填充 → 高亮演示。
      配置了 DeepSeek Key 时优先用 AI 结构化解析（识别更稳），失败或未配置退回规则解析 */
  const [importing, setImporting] = useState(false)
  const handleImportFile = async (file: File) => {
    setImporting(true)
    try {
      const { text, photo } = await extractResume(file)
      if (text.trim().length < 10) {
        notify('未能读取到文字内容：扫描图片型 PDF 暂不支持，请改用文字版 PDF 或 Word 文件')
        return
      }
      let parsed: Partial<ResumeData> | null = null
      let found: string[] = []
      let workingText = text
      if (loadApiKey()) {
        try {
          // 第一步：AI 核对抽取文本（修复乱码、断行、页眉页脚噪声），失败则静默回退原文
          workingText = await aiCleanResumeText(text)
          // 第二步：AI 结构化解析核对后的文本
          parsed = await aiParseResume(workingText)
          const p = parsed
          found = ['姓名', '经历', '技能特长'].filter((k) => {
            if (k === '姓名') return !!p.name
            if (k === '技能特长') return (p.skills?.length ?? 0) > 0
            return (p.jobs?.length ?? 0) > 0 || (p.projects?.length ?? 0) > 0
          })
        } catch (err) {
          notify(`${err instanceof Error ? err.message : 'AI 解析失败'}，已改用规则解析`)
        }
      }
      if (!parsed) {
        const ruleResult = parseResumeText(workingText)
        parsed = ruleResult.data
        found = ruleResult.found
      }
      const updates = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined && v !== '')) as Partial<ResumeData>
      if (photo) updates.avatar = photo
      if (Object.keys(updates).length === 0) {
        notify('已读取文档，但未识别出标准简历字段，请检查文件内容或手动填写')
        return
      }
      setData((prev) => ({
        ...prev,
        ...updates,
        jobs: updates.jobs ?? prev.jobs,
        skills: updates.skills ?? prev.skills,
        projects: updates.projects ?? prev.projects,
      }))
      setDirty(true)
      // 依次高亮被填充的字段，演示同步效果
      const keys = ['name', 'intent', 'phone', 'email', ...(photo ? ['avatar'] : [])].filter((k) => k in updates)
      keys.forEach((k, i) => window.setTimeout(() => flash(k), 400 + i * 500))
      notify(`已从「${file.name}」导入：${[...found, ...(photo ? ['证件照'] : [])].join(' / ') || '部分信息'}，请核对并补充细节`)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      notify(message.includes('仅支持') ? message : '解析失败：文件可能已损坏或格式特殊，请重试其他文件')
    } finally {
      setImporting(false)
    }
  }

  // 完成度：证件照与项目经历默认未填 → 初始 85%（与设计稿一致）
  const completion = useMemo(() => {
    const projects = data.projects ?? []
    const checks = [
      data.name,
      data.intent,
      data.phone,
      data.email,
      ...data.jobs.flatMap((j) => [j.name || j.company, j.role, j.period, j.desc || j.duties || j.result || '']),
      data.school,
      data.eduPeriod,
      data.summary,
      data.skills.length > 0 ? '✓' : '',
      data.avatar ?? '', // 证件照（未上传）
      ...projects.flatMap((p) => [p.name, p.role, p.period, p.desc || p.duties || p.result || '']),
    ]
    const filled = checks.filter((v) => v.trim() !== '').length
    return Math.floor((filled / checks.length) * 100)
  }, [data])

  return (
    <div id="app-root" className="relative h-dvh w-full overflow-hidden bg-[var(--bg-canvas)]">
      <div id="app-shell" className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)]">
        <TopBar
          templateId={templateId}
          onSelectTemplate={selectTemplate}
          onShare={handleShare}
          onPrint={handlePrint}
          dataName={data.name}
          styleOverride={styleOverride}
          onChangeStyle={setStyleOverride}
          onImportFile={handleImportFile}
          importing={importing}
          onOpenAi={() => {
            setAiScope(null)
            setAiOpen(true)
          }}
        />
        <main className="flex min-h-0 flex-1">
          <div className={mobileView === 'edit' ? 'contents' : 'hidden md:contents'}>
            <EditorPanel
              data={data}
              highlight={highlight}
              completion={completion}
              onEdit={onEdit}
              onFlash={flash}
              setData={(updater) => {
                setDirty(true)
                setData((prev) => updater(prev))
              }}
              onNotify={notify}
              focusSection={focusSection}
              onFocused={() => setFocusSection(null)}
              onAskAi={handleAskAi}
            />
          </div>
          <div className={mobileView === 'preview' ? 'contents' : 'hidden md:contents'}>
            <PreviewPane
              data={data}
              template={template}
              onRenameTitle={handleRenameTitle}
              highlight={highlight}
              styleOverride={styleOverride}
              onPagesChange={setSharedPages}
              order={blockOrder}
              onReorder={handleReorder}
              onBlocksChange={handleBlocksChange}
              onResetOrder={() => setBlockOrder(null)}
              onEditRequest={handleEditRequest}
            />
          </div>
        </main>

        {/* 移动端底部切换栏：编辑 / 预览 */}
        <nav className="flex h-14 shrink-0 items-stretch border-t border-[var(--border-subtle)] bg-white md:hidden">
          {(
            [
              ['edit', '编辑简历'],
              ['preview', '简历预览'],
            ] as const
          ).map(([key, label]) => {
            const active = mobileView === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMobileView(key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors ${
                  active ? 'text-[var(--accent-text)]' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {active && <span className="absolute inset-x-8 top-0 h-[2.5px] rounded-full bg-[var(--accent-strong)]" />}
                {label}
              </button>
            )
          })}
        </nav>

        {/* AI 助手（DeepSeek）：优化建议体检 + 对话式改进 */}
        <AiPanel
          open={aiOpen}
          data={data}
          section={aiScope ? { key: aiScope, label: aiScope === 'personal' ? '个人信息' : aiScope === 'jobs' ? '工作经历' : aiScope === 'projects' ? '项目经历' : aiScope === 'edu' ? '教育背景' : aiScope === 'skills' ? '技能特长' : '自我评价' } : null}
          prevSnapshot={aiPrev}
          onApply={handleAiApply}
          onApplySuggestion={handleAiApplySuggestion}
          onUndo={handleAiUndo}
          onNotify={notify}
          onClose={() => setAiOpen(false)}
        />

        {/* 操作反馈 Toast */}
        {toast && (
          <div className="absolute left-1/2 top-[76px] z-[60] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#2F3B38] px-4 py-2.5 text-xs text-white shadow-[0_8px_24px_rgba(15,20,25,0.3)]">
            <CheckCircleIcon className="h-[15px] w-[15px]" />
            {toast}
          </div>
        )}
      </div>

      {/* 打印副本（下载 PDF 用）：屏幕上隐藏，打印时替代整个应用；分页结果复用预览实例的测量值 */}
      <div id="print-area" aria-hidden="true">
        <ResumePaper
          data={data}
          template={template}
          highlight={null}
          print
          styleOverride={styleOverride}
          externalPages={sharedPages}
          order={blockOrder}
        />
      </div>
    </div>
  )
}
