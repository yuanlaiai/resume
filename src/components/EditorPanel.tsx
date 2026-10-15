import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { JobProject, ResumeData } from '../types'
import { CameraIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon } from './icons'

/** 编辑面板模块 key（与纸张点击联动） */
export type EditorSection = 'personal' | 'jobs' | 'projects' | 'edu' | 'skills' | 'summary'

interface EditorPanelProps {
  data: ResumeData
  highlight: string | null
  completion: number
  onEdit: (key: string, value: string) => void
  onFlash: (key: string) => void
  setData: (updater: (prev: ResumeData) => ResumeData) => void
  onNotify?: (message: string) => void
  /** 点击纸张区块 → 展开并滚动到对应编辑模块（tick 变化触发） */
  focusSection?: { key: EditorSection; tick: number } | null
  onFocused?: () => void
  /** 点击某模块的 AI 按钮 → 打开 AI 助手并限定优化范围 */
  onAskAi?: (key: EditorSection) => void
}

const inputBase =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]'

function TextInput({
  value,
  hot,
  onChange,
  placeholder,
}: {
  value: string
  hot: boolean
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${hot ? 'field-hot font-medium' : ''} h-[38px]`}
    />
  )
}

function Field({
  label,
  value,
  hot,
  onChange,
  placeholder,
  children,
}: {
  label: string
  value: string
  hot: boolean
  onChange: (v: string) => void
  placeholder?: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <TextInput value={value} hot={hot} onChange={onChange} placeholder={placeholder} />
      {children}
    </div>
  )
}

/** 字数输入框与textarea的最大长度 */
const RICH_LIMIT = 2000

/**
 * 富文本编辑区：工具栏支持加粗（**）、关键字突出（==）、无序/有序列表。
 * 选中文字点按钮 → 包裹/取消对应标记；列表按钮作用于选中行（无选区时为光标所在行）。
 * 纸张端由 renderRich / renderDescLine 解析渲染。
 */
function RichTextarea({
  value,
  placeholder,
  hot,
  onChange,
}: {
  value: string
  placeholder?: string
  hot?: boolean
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const wrap = (marker: string) => {
    const el = ref.current
    if (!el || value.length > RICH_LIMIT) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const len = marker.length
    const sel = value.slice(s, e)
    let next: string
    let selStart: number
    let selEnd: number
    if (s >= len && value.slice(s - len, s) === marker && value.slice(e, e + len) === marker) {
      // 光标/选区已处于标记内 → 取消
      next = value.slice(0, s - len) + sel + value.slice(e + len)
      selStart = s - len
      selEnd = e - len
    } else if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length > len * 2) {
      // 连标记一起选中 → 去掉标记
      const inner = sel.slice(len, -len)
      next = value.slice(0, s) + inner + value.slice(e)
      selStart = s
      selEnd = s + inner.length
    } else {
      // 包裹标记（无选区时插入空标记，光标落在中间）
      next = value.slice(0, s) + marker + sel + marker + value.slice(e)
      selStart = s + len
      selEnd = s + len + sel.length
    }
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(selStart, selEnd)
    })
  }

  /** 列表开关：作用于选中行；全部已带该列表标记时取消，否则统一加上 */
  const toggleList = (kind: 'ul' | 'ol') => {
    const el = ref.current
    if (!el || value.length > RICH_LIMIT) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const ls = value.lastIndexOf('\n', s - 1) + 1
    const nl = value.indexOf('\n', e)
    const le = nl === -1 ? value.length : nl
    const lines = value.slice(ls, le).split('\n')
    const strip = (t: string) => t.replace(/^\s*(?:[-–—*•·]|\d{1,2}[.、)])\s*/, '')
    const ulRe = /^\s*[-–—*•·]\s*/
    const olRe = /^\s*\d{1,2}[.、)]\s*/
    const allMarked = lines.every((l) => (kind === 'ul' ? ulRe : olRe).test(l))
    const block = lines
      .map((l, i) => (allMarked ? strip(l) : `${kind === 'ul' ? '- ' : `${i + 1}. `}${strip(l)}`))
      .join('\n')
    onChange(value.slice(0, ls) + block + value.slice(le))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(ls, ls + block.length)
    })
  }

  const btn =
    'flex h-6 min-w-7 items-center justify-center rounded-[5px] border border-[var(--border-subtle)] px-1 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] text-[var(--text-tertiary)]">选中后点工具按钮：B 加粗 · 高 突出 · ≡ 列表，纸张实时生效</span>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('**')} title="加粗选中文字" className={btn}>
            B
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('==')} title="关键字突出（主题色下划线）" className={btn}>
            高
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleList('ul')} title="无序列表（- 开头）" className={btn}>
            ≡
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleList('ol')} title="有序列表（1. 2. 3.）" className={btn}>
            1.
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} h-[76px] resize-none py-2.5 text-xs leading-[19px] ${hot ? 'field-hot' : ''}`}
      />
    </div>
  )
}

function Section({
  title,
  expanded,
  onToggle,
  badge,
  action,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-b border-[var(--border-subtle)]">
      <div className="flex items-center justify-between px-6 pt-5">
        <button type="button" onClick={onToggle} className="flex items-center gap-2">
          {expanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        </button>
        {badge}
        {action}
      </div>
      {expanded && <div className="flex flex-col gap-3.5 px-6 pb-5 pt-3.5">{children}</div>}
    </div>
  )
}

function Badge({ text }: { text: string }) {
  return (
    <span className="flex h-5 items-center rounded-full bg-[var(--accent-tint)] px-2 text-[10px] font-medium text-[var(--accent-text)]">
      {text}
    </span>
  )
}

export default function EditorPanel({ data, highlight, completion, onEdit, onFlash, setData, onNotify, focusSection, onFocused, onAskAi }: EditorPanelProps) {
  const [expanded, setExpanded] = useState({ personal: true, jobs: true, edu: false, projects: false, skills: false, summary: false })
  const toggle = (key: keyof typeof expanded) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  /**
   * 技能特长文本域。
   * 输入过程中保留用户敲出的空行（否则回车后光标会跳），落库时再按行剔除空项；
   * 只有来自外部的改动（导入 / AI 应用建议）才会覆盖草稿。
   */
  const skillsText = data.skills.join('\n')
  const [skillsDraft, setSkillsDraft] = useState(skillsText)
  const skillsSynced = useRef(skillsText)
  useEffect(() => {
    if (skillsText === skillsSynced.current) return
    setSkillsDraft(skillsText)
    skillsSynced.current = skillsText
  }, [skillsText])
  const changeSkills = (value: string) => {
    setSkillsDraft(value)
    const next = value.split('\n').map((s) => s.trim()).filter(Boolean)
    skillsSynced.current = next.join('\n')
    setData((prev) => ({ ...prev, skills: next }))
    onFlash('skills')
  }

  /**
   * 教育背景的学校 / 专业学历拆分展示。
   * 旧数据可能合并存放在 school（「同济大学 · 软件工程（本科）」）：优先读 eduMajor，
   * 否则按分隔符从 school 拆出；首次编辑学校时自动把专业部分迁移到 eduMajor，避免丢失。
   */
  const eduMajor = (data.eduMajor ?? '').trim()
  const eduSplit = (() => {
    if (eduMajor) return { school: data.school.trim(), major: eduMajor }
    const i = data.school.search(/[·・｜|]/)
    return i < 0
      ? { school: data.school.trim(), major: '' }
      : { school: data.school.slice(0, i).trim(), major: data.school.slice(i + 1).trim() }
  })()
  const editSchool = (v: string) => {
    if (!eduMajor) onEdit('eduMajor', eduSplit.major)
    onEdit('school', v)
  }

  /** 模块右上角的 AI 优化入口 */
  const askAiBtn = (key: EditorSection) =>
    onAskAi && (
      <button
        type="button"
        onClick={() => onAskAi(key)}
        title={`让 AI 优化${key === 'personal' ? '个人信息' : key === 'jobs' ? '工作经历' : key === 'projects' ? '项目经历' : key === 'edu' ? '教育背景' : key === 'skills' ? '技能特长' : '自我评价'}`}
        className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-tint)] hover:text-[var(--accent-text)]"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
      </button>
    )

  const rootRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<EditorSection, HTMLDivElement | null>>({
    personal: null, jobs: null, projects: null, edu: null, skills: null, summary: null,
  })

  /** 点击纸张区块 → 展开对应模块并滚动到可见 */
  useEffect(() => {
    if (!focusSection) return
    const { key, tick } = focusSection
    setExpanded((p) => ({ ...p, [key]: true }))
    onFocused?.()
    // 等展开渲染完成后再滚动
    const t = window.setTimeout(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    void tick
    return () => window.clearTimeout(t)
  }, [focusSection, onFocused])

  const updateJob = (index: number, field: keyof ResumeData['jobs'][number], value: string) => {
    onEdit(`jobs.${index}.${field}`, value)
  }

  const addJob = () =>
    setData((prev) => ({ ...prev, jobs: [...prev.jobs, { company: '', role: '', period: '', desc: '' }] }))

  const removeJob = (index: number) => {
    setData((prev) => ({ ...prev, jobs: prev.jobs.filter((_, i) => i !== index) }))
    onFlash(`jobs.0.company`)
  }

  /* ---- 工作经历下的项目（项目制简历：「公司 + 职位」下面挂 项目一/二/三） ---- */
  const addJobProject = (index: number) =>
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job, i) =>
        i === index ? { ...job, projects: [...(job.projects ?? []), { name: '', role: '', period: '', desc: '' }] } : job,
      ),
    }))

  const updateJobProject = (index: number, pIndex: number, field: keyof JobProject, value: string) =>
    onEdit(`jobs.${index}.projects.${pIndex}.${field}`, value)

  const removeJobProject = (index: number, pIndex: number) =>
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job, i) =>
        i === index ? { ...job, projects: (job.projects ?? []).filter((_, j) => j !== pIndex) } : job,
      ),
    }))

  const updateProject = (index: number, field: keyof NonNullable<ResumeData['projects']>[number], value: string) => {
    onEdit(`projects.${index}.${field}`, value)
  }
  const addProject = () =>
    setData((prev) => ({
      ...prev,
      projects: [...(prev.projects ?? []), { name: '', role: '', period: '', desc: '' }],
    }))
  const removeProject = (index: number) => {
    setData((prev) => ({ ...prev, projects: (prev.projects ?? []).filter((_, i) => i !== index) }))
    onFlash('projects.0.name')
  }

  /** 头像上传：本地读取为 base64，同步到右侧纸张预览 */
  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一张图片
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      onNotify?.('仅支持 PNG / JPG / WebP 格式的图片')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      onNotify?.('图片请控制在 3MB 以内')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setData((prev) => ({ ...prev, avatar: reader.result as string }))
      onFlash('avatar')
    }
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    setData((prev) => ({ ...prev, avatar: undefined }))
    onFlash('avatar')
  }

  return (
    <aside ref={rootRef} className="flex w-full shrink-0 flex-col overflow-y-auto border-r border-[var(--border-subtle)] bg-white md:w-[420px]">
      {/* ===== 个人信息 ===== */}
      <div ref={(el) => { sectionRefs.current.personal = el }}>
      <Section
        title="个人信息"
        expanded={expanded.personal}
        onToggle={() => toggle('personal')}
        badge={<Badge text="已完成" />}
        action={askAiBtn('personal')}
      >
        <div className="flex items-center gap-3.5">
          <label className="group relative h-[76px] w-[54px] cursor-pointer overflow-hidden rounded-[4px] border border-[var(--border-strong)] bg-[var(--bg-preview)]">
            {data.avatar ? (
              <img src={data.avatar} alt="证件照" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[var(--text-tertiary)]">
                <CameraIcon className="h-4 w-4" />
                <span className="text-[9px]">证件照</span>
              </span>
            )}
            {data.avatar && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                更换
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </label>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-[var(--text-tertiary)]">
              {data.avatar ? '照片已上传，将同步显示在简历上' : '上传证件照，HR 好感度更高'}
            </span>
            {data.avatar && (
              <button
                type="button"
                onClick={removeAvatar}
                className="self-start text-[11px] text-[var(--accent-text)] hover:underline"
              >
                移除照片
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Field label="姓名" value={data.name} hot={highlight === 'name'} onChange={(v) => onEdit('name', v)} />
          <Field label="求职意向" value={data.intent} hot={highlight === 'intent'} onChange={(v) => onEdit('intent', v)}>
            {highlight === 'intent' && (
              <div className="flex items-center gap-[5px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber-border)]" />
                <span className="text-[11px] text-[var(--amber-text)]">刚刚修改 · 已同步到预览</span>
              </div>
            )}
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="手机号" value={data.phone} hot={highlight === 'phone'} onChange={(v) => onEdit('phone', v)} />
          <Field label="邮箱" value={data.email} hot={highlight === 'email'} onChange={(v) => onEdit('email', v)} />
        </div>

        <div className="flex gap-3">
          <Field
            label="工作年限"
            value={data.years ?? ''}
            hot={highlight === 'years'}
            placeholder="如：5 年经验"
            onChange={(v) => onEdit('years', v)}
          />
          <Field
            label="所在城市"
            value={data.city ?? ''}
            hot={highlight === 'city'}
            placeholder="如：上海"
            onChange={(v) => onEdit('city', v)}
          />
        </div>
      </Section>
      </div>

      {/* ===== 工作经历 ===== */}
      <div ref={(el) => { sectionRefs.current.jobs = el }}>
      <Section
        title="工作经历"
        expanded={expanded.jobs}
        onToggle={() => toggle('jobs')}
        action={
          <div className="flex items-center gap-3">
            {askAiBtn('jobs')}
            <button type="button" onClick={addJob} className="text-xs font-medium text-[var(--accent-text)] hover:text-[var(--accent-strong)]">
              + 添加经历
            </button>
          </div>
        }
      >
        {data.jobs.map((job, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[10px] bg-[var(--card-bg)] p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex min-w-0 flex-1 gap-2.5">
                <input
                  value={job.company}
                  placeholder="公司 / 单位"
                  onChange={(e) => updateJob(i, 'company', e.target.value)}
                  className={`${inputBase} h-9 ${highlight === `jobs.${i}.company` ? 'field-hot font-medium' : ''}`}
                />
                <input
                  value={job.role}
                  placeholder="职位 / 角色"
                  onChange={(e) => updateJob(i, 'role', e.target.value)}
                  className={`${inputBase} h-9 ${highlight === `jobs.${i}.role` ? 'field-hot font-medium' : ''}`}
                />
              </div>
              {data.jobs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeJob(i)}
                  className="mt-1.5 shrink-0 text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-red-500"
                  title="删除这段经历"
                >
                  删除
                </button>
              )}
            </div>
            <div className="flex gap-2.5">
              <input
                value={job.period}
                placeholder="2021.07 – 至今"
                onChange={(e) => updateJob(i, 'period', e.target.value)}
                className={`${inputBase} h-9 ${highlight === `jobs.${i}.period` ? 'field-hot font-medium' : ''}`}
              />
            </div>
            <input
              value={job.tech ?? ''}
              placeholder="技术栈（选填）：Java / Spring Boot / Vue3"
              onChange={(e) => updateJob(i, 'tech', e.target.value)}
              className={`${inputBase} h-9 ${highlight === `jobs.${i}.tech` ? 'field-hot font-medium' : ''}`}
            />
            <RichTextarea
              value={job.desc}
              placeholder="项目描述 / 工作内容：一事一行，可从「- 」开始"
              hot={highlight === `jobs.${i}.desc`}
              onChange={(v) => updateJob(i, 'desc', v)}
            />
            <RichTextarea
              value={job.duties ?? ''}
              placeholder="核心职责（选填）：每行一条职责，用「- 」开头"
              hot={highlight === `jobs.${i}.duties`}
              onChange={(v) => updateJob(i, 'duties', v)}
            />
            <RichTextarea
              value={job.result ?? ''}
              placeholder="项目成果（选填）：用数字说话，如 QPS 提升 300%"
              hot={highlight === `jobs.${i}.result`}
              onChange={(v) => updateJob(i, 'result', v)}
            />

            {/* 本项目经历下的项目（有公司+职位时使用） */}
            {(job.projects ?? []).length > 0 && (
              <div className="flex flex-col gap-3 rounded-[10px] border border-dashed border-[var(--border-subtle)] p-2.5">
                {(job.projects ?? []).map((p, j) => (
                  <div key={j} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">项目 {j + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeJobProject(i, j)}
                        className="text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-red-500"
                      >
                        删除
                      </button>
                    </div>
                    <div className="flex gap-2.5">
                      <input
                        value={p.name}
                        placeholder="项目名称"
                        onChange={(e) => updateJobProject(i, j, 'name', e.target.value)}
                        className={`${inputBase} h-9 min-w-0 ${highlight === `jobs.${i}.projects.${j}.name` ? 'field-hot font-medium' : ''}`}
                      />
                      <div className="w-[138px] shrink-0">
                        <input
                          value={p.period}
                          placeholder="项目时间"
                          onChange={(e) => updateJobProject(i, j, 'period', e.target.value)}
                          className={`${inputBase} h-9 ${highlight === `jobs.${i}.projects.${j}.period` ? 'field-hot font-medium' : ''}`}
                        />
                      </div>
                    </div>
                    <input
                      value={p.role}
                      placeholder="角色（如 核心开发 / 架构负责人）"
                      onChange={(e) => updateJobProject(i, j, 'role', e.target.value)}
                      className={`${inputBase} h-9 ${highlight === `jobs.${i}.projects.${j}.role` ? 'field-hot font-medium' : ''}`}
                    />
                    <input
                      value={p.tech ?? ''}
                      placeholder="技术栈（选填）：Java / Spring Boot / Vue3"
                      onChange={(e) => updateJobProject(i, j, 'tech', e.target.value)}
                      className={`${inputBase} h-9 ${highlight === `jobs.${i}.projects.${j}.tech` ? 'field-hot font-medium' : ''}`}
                    />
                    <RichTextarea
                      value={p.desc}
                      placeholder="项目描述：一事一行，可从「- 」开始"
                      hot={highlight === `jobs.${i}.projects.${j}.desc`}
                      onChange={(v) => updateJobProject(i, j, 'desc', v)}
                    />
                    <RichTextarea
                      value={p.duties ?? ''}
                      placeholder="核心职责（选填）：每行一条职责，用「- 」开头"
                      hot={highlight === `jobs.${i}.projects.${j}.duties`}
                      onChange={(v) => updateJobProject(i, j, 'duties', v)}
                    />
                    <RichTextarea
                      value={p.result ?? ''}
                      placeholder="项目成果（选填）：用数字说话"
                      hot={highlight === `jobs.${i}.projects.${j}.result`}
                      onChange={(v) => updateJobProject(i, j, 'result', v)}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addJobProject(i)}
              className="self-start text-xs font-medium text-[var(--accent-text)] hover:text-[var(--accent-strong)]"
            >
              + 添加项目
            </button>
          </div>
        ))}
      </Section>
      </div>

      {/* ===== 项目经历 ===== */}
      <div ref={(el) => { sectionRefs.current.projects = el }}>
      <Section
        title="项目经历"
        expanded={expanded.projects}
        onToggle={() => toggle('projects')}
        badge={(data.projects?.length ?? 0) > 0 ? <Badge text={`${data.projects!.length} 项`} /> : undefined}
        action={
          <div className="flex items-center gap-3">
            {askAiBtn('projects')}
            <button type="button" onClick={addProject} className="text-xs font-medium text-[var(--accent-text)] hover:text-[var(--accent-strong)]">
              + 添加项目
            </button>
          </div>
        }
      >
        {(data.projects ?? []).length === 0 ? (
          <div className="rounded-lg bg-[var(--card-bg)] p-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            还没有项目经历。补充 1–2 个最有代表性的项目，能让简历说服力翻倍。
          </div>
        ) : (
          (data.projects ?? []).map((proj, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-[10px] bg-[var(--card-bg)] p-3">
              <div className="flex items-start gap-2.5">
                <div className="flex min-w-0 flex-1 gap-2.5">
                  <input
                    value={proj.name}
                    placeholder="项目名称"
                    onChange={(e) => updateProject(i, 'name', e.target.value)}
                    className={`${inputBase} h-9 ${highlight === `projects.${i}.name` ? 'field-hot font-medium' : ''}`}
                  />
                  <input
                    value={proj.role}
                    placeholder="担任角色"
                    onChange={(e) => updateProject(i, 'role', e.target.value)}
                    className={`${inputBase} h-9 ${highlight === `projects.${i}.role` ? 'field-hot font-medium' : ''}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeProject(i)}
                  className="mt-1.5 shrink-0 text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-red-500"
                  title="删除这个项目"
                >
                  删除
                </button>
              </div>
              <input
                value={proj.period}
                placeholder="2022.01 – 2022.12"
                onChange={(e) => updateProject(i, 'period', e.target.value)}
                className={`${inputBase} h-9 w-[200px] ${highlight === `projects.${i}.period` ? 'field-hot font-medium' : ''}`}
              />
              <input
                value={proj.tech ?? ''}
                placeholder="技术栈（选填）：Java / Spring Boot / Vue3"
                onChange={(e) => updateProject(i, 'tech', e.target.value)}
                className={`${inputBase} h-9 ${highlight === `projects.${i}.tech` ? 'field-hot font-medium' : ''}`}
              />
              <RichTextarea
                value={proj.desc}
                placeholder="项目描述：项目背景与你负责的部分…"
                hot={highlight === `projects.${i}.desc`}
                onChange={(v) => updateProject(i, 'desc', v)}
              />
              <RichTextarea
                value={proj.duties ?? ''}
                placeholder="核心职责（选填）：每行一条职责，用「- 」开头"
                hot={highlight === `projects.${i}.duties`}
                onChange={(v) => updateProject(i, 'duties', v)}
              />
              <RichTextarea
                value={proj.result ?? ''}
                placeholder="项目成果（选填）：用数字说话，如 QPS 提升 300%"
                hot={highlight === `projects.${i}.result`}
                onChange={(v) => updateProject(i, 'result', v)}
              />
            </div>
          ))
        )}
      </Section>
      </div>

      {/* ===== 教育背景 ===== */}
      <div ref={(el) => { sectionRefs.current.edu = el }}>
      <Section title="教育背景" expanded={expanded.edu} onToggle={() => toggle('edu')} badge={<Badge text="1 项" />} action={askAiBtn('edu')}>
        <div className="flex gap-3">
          <Field label="学校" value={eduSplit.school} hot={highlight === 'school'} onChange={editSchool} />
          <Field label="时间" value={data.eduPeriod} hot={highlight === 'eduPeriod'} onChange={(v) => onEdit('eduPeriod', v)} />
        </div>
        <div className="mt-3">
          <Field label="专业 / 学历" value={eduSplit.major} hot={highlight === 'eduMajor'} onChange={(v) => onEdit('eduMajor', v)} placeholder="如：软件工程（本科）" />
        </div>
      </Section>
      </div>

      {/* ===== 技能特长 ===== */}
      <div ref={(el) => { sectionRefs.current.skills = el }}>
      <Section title="技能特长" expanded={expanded.skills} onToggle={() => toggle('skills')} badge={<Badge text={`${data.skills.length} 条`} />} action={askAiBtn('skills')}>
        <textarea
          value={skillsDraft}
          onChange={(e) => changeSkills(e.target.value)}
          rows={4}
          placeholder={'一行一条，可直接粘贴整段技能文本：\nJava、Spring Boot、MySQL、Redis\n熟悉 RAG 检索增强生成与 Agent 工作流'}
          className={`${inputBase} min-h-[84px] resize-y py-2 leading-[1.8] ${highlight === 'skills' ? 'field-hot font-medium' : ''}`}
        />
        <p className="text-[11px] text-[var(--text-tertiary)]">一行一条，纸张上按行自动编号；自带「1、」等序号会自动统一。</p>
      </Section>
      </div>

      {/* ===== 自我评价 ===== */}
      <div ref={(el) => { sectionRefs.current.summary = el }}>
      <Section title="自我评价" expanded={expanded.summary} onToggle={() => toggle('summary')} action={askAiBtn('summary')}>
        <RichTextarea
          value={data.summary}
          placeholder="3–4 句概括你的核心竞争力、经验领域与工作风格…"
          hot={highlight === 'summary'}
          onChange={(v) => onEdit('summary', v)}
        />
      </Section>
      </div>

      {/* ===== 完成度 ===== */}
      <div className="flex items-center gap-3 px-6 pb-4 pt-3.5">
        <span className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)]">完成度 {completion}%</span>
        <div className="h-[5px] flex-1 rounded-full bg-[var(--track)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
    </aside>
  )
}
