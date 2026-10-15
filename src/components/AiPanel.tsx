import { useEffect, useRef, useState } from 'react'
import type { ResumeData } from '../types'
import { aiImproveResume, aiSuggestImprovements, loadApiKey, saveApiKey, type ChatMsg, type Suggestion } from '../lib/deepseek'
import { renderRich } from './ResumePaper'
import type { EditorSection } from './EditorPanel'
import { SparklesIcon, XIcon } from './icons'

interface AiPanelProps {
  open: boolean
  data: ResumeData
  /** 对话范围：null = 全简历；指定 key 时只优化对应模块 */
  section: { key: EditorSection; label: string } | null
  /** 上一次 AI 应用前的快照（支持撤销），null = 无可撤销 */
  prevSnapshot: ResumeData | null
  /** 应用 AI 全量改进结果 */
  onApply: (next: ResumeData, note: string) => void
  /** 应用单条优化建议（字段路径写回） */
  onApplySuggestion: (path: string, value: string) => void
  onUndo: () => void
  onNotify: (message: string) => void
  onClose: () => void
}

interface Bubble {
  role: 'user' | 'assistant'
  text: string
}

/** 各模块的当前内容（作为对话上下文） */
function sectionContent(key: EditorSection, data: ResumeData): string {
  const slim = { ...data, avatar: undefined }
  switch (key) {
    case 'personal':
      return JSON.stringify({ name: slim.name, intent: slim.intent, years: slim.years, city: slim.city, phone: slim.phone, email: slim.email })
    case 'jobs':
      return JSON.stringify(slim.jobs)
    case 'projects':
      return JSON.stringify(slim.projects ?? [])
    case 'edu':
      return JSON.stringify({ school: slim.school, eduMajor: slim.eduMajor, eduPeriod: slim.eduPeriod })
    case 'skills':
      return slim.skills.join('；')
    case 'summary':
      return slim.summary
  }
}

/** 对话式改进的快捷指令（全简历 / 单块通用） */
const QUICK_PROMPTS = [
  '给描述排版：每条要点列表化，关键词加粗，量化成果突出显示',
  '把工作描述改得更量化，突出成果数据',
  '自我评价重写得更有说服力，去掉空话',
  '整体润色一遍，用动词开头、突出亮点',
]

export default function AiPanel({ open, data, section, prevSnapshot, onApply, onApplySuggestion, onUndo, onNotify, onClose }: AiPanelProps) {
  const [tab, setTab] = useState<'suggest' | 'chat'>('suggest')
  const [keyInput, setKeyInput] = useState('')
  const [keySaved, setKeySaved] = useState(false)

  // 体检建议
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // 对话
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const historyRef = useRef<ChatMsg[]>([])
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) {
      setKeySaved(!!loadApiKey())
      setKeyInput('')
    }
  }, [open])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [bubbles, busy, suggestBusy])

  /** 打开面板且配置了 Key 时，自动做一次全量体检（每次打开只做一次） */
  const autoFetchedRef = useRef(false)
  useEffect(() => {
    if (open && keySaved && !autoFetchedRef.current) {
      autoFetchedRef.current = true
      void fetchSuggestions()
    }
    if (!open) autoFetchedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keySaved])

  if (!open) return null

  const fetchSuggestions = async () => {
    if (!loadApiKey()) {
      onNotify('未检测到 DeepSeek API Key：请在 AI 助手中填写，或在项目 .env 配置 VITE_DEEPSEEK_API_KEY')
      return
    }
    setSuggestBusy(true)
    try {
      const list = await aiSuggestImprovements(data)
      setSuggestions(list)
      setApplied(new Set())
      setDismissed(new Set())
      if (list.length === 0) setSuggestions([])
    } catch (err) {
      setSuggestions([])
      onNotify(err instanceof Error ? err.message : 'AI 体检失败，请重试')
    } finally {
      setSuggestBusy(false)
    }
  }

  const applySuggestion = (s: Suggestion) => {
    onApplySuggestion(s.path, s.suggested)
    setApplied((p) => new Set(p).add(s.path))
    onNotify(`已应用建议：${s.label}`)
  }

  const applyAll = () => {
    if (!suggestions) return
    suggestions.forEach((s) => {
      if (!applied.has(s.path) && !dismissed.has(s.path)) onApplySuggestion(s.path, s.suggested)
    })
    setApplied(new Set(suggestions.map((s) => s.path)))
    onNotify('已应用全部优化建议')
  }

  const persistKey = () => {
    saveApiKey(keyInput.trim())
    setKeySaved(!!loadApiKey())
    setKeyInput('')
    onNotify(loadApiKey() ? 'DeepSeek API Key 已保存到本机' : '已清除 API Key')
  }

  const send = async (raw?: string) => {
    const instruction = (raw ?? input).trim()
    if (!instruction || busy) return
    if (!loadApiKey()) {
      onNotify('未检测到 DeepSeek API Key：请在 AI 助手中填写，或在项目 .env 配置 VITE_DEEPSEEK_API_KEY')
      return
    }
    setInput('')
    const scopeLabel = section?.label
    setBubbles((b) => [...b, { role: 'user', text: scopeLabel ? `【${scopeLabel}】${instruction}` : instruction }])
    setBusy(true)
    try {
      const { data: next, note } = await aiImproveResume(data, instruction, historyRef.current, scopeLabel)
      historyRef.current.push({ role: 'user', content: instruction })
      historyRef.current.push({ role: 'assistant', content: note })
      setBubbles((b) => [...b, { role: 'assistant', text: note }])
      onApply(next, note)
    } catch (err) {
      setBubbles((b) => [...b, { role: 'assistant', text: `⚠️ ${err instanceof Error ? err.message : '请求失败，请重试'}` }])
    } finally {
      setBusy(false)
    }
  }

  const pendingSuggestions = (suggestions ?? []).filter((s) => !applied.has(s.path) && !dismissed.has(s.path))

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/35"
      onClick={busy || suggestBusy ? undefined : onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[88vh] w-[min(600px,calc(100vw-24px))] flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI 助手"
      >
        {/* 头部 + 标签页 */}
        <div className="border-b border-[var(--border-subtle)] px-6 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-[18px] w-[18px] text-[var(--accent-text)]" />
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">AI 助手 · DeepSeek</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                  {section ? `优化范围：${section.label} · 只改进这一块` : '自动体检 + 对话式改进，改动可撤销'}
                </div>
              </div>
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
          <div className="mt-3 flex gap-1">
            {(
              [
                ['suggest', '优化建议'],
                ['chat', '对话改进'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-t-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  tab === k
                    ? 'border-b-2 border-[var(--accent-strong)] text-[var(--accent-text)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key 设置 */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-6 py-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${keySaved ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <input
            type="password"
            value={keyInput}
            placeholder={keySaved ? 'API Key 已配置，可重新粘贴更换' : '粘贴 DeepSeek API Key（sk-…），或已在 .env 配置则无需填写'}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && persistKey()}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={persistKey}
            className="h-8 shrink-0 rounded-lg bg-[var(--accent-strong)] px-3 text-xs font-medium text-white transition-colors hover:bg-[#457C74]"
          >
            保存
          </button>
        </div>

        {/* ===== 优化建议 ===== */}
        {tab === 'suggest' && (
          <div className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
            {!keySaved && (
              <p className="rounded-lg bg-[var(--accent-tint)] px-3 py-2.5 text-xs leading-relaxed text-[var(--accent-text)]">
                填好 DeepSeek API Key 后，AI 会按业界最佳实践（量化成果 / 强动词开头 / STAR 法则等）自动体检简历，给出可逐条确认的修改建议。
              </p>
            )}
            {suggestBusy && (
              <div className="flex items-center gap-2 py-8 text-xs text-[var(--text-tertiary)]">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                AI 正在通读简历、对照优化规则体检…
              </div>
            )}
            {!suggestBusy && suggestions && suggestions.length === 0 && (
              <p className="py-8 text-center text-xs text-[var(--text-tertiary)]">没发现需要改进的地方，这份简历已经很不错了 👍</p>
            )}
            {!suggestBusy &&
              (suggestions ?? []).map((s) => {
                const done = applied.has(s.path)
                const dropped = dismissed.has(s.path)
                if (dropped) return null
                return (
                  <div
                    key={s.path}
                    className={`flex flex-col gap-2 rounded-xl border p-3 transition-opacity ${
                      done ? 'border-[var(--border-subtle)] opacity-55' : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{s.label}</span>
                      <span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] text-[var(--accent-text)]">{s.reason}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[11.5px] leading-[18px]">
                      {s.original && <p className="text-[var(--text-tertiary)] line-through decoration-[var(--text-tertiary)]/50">{s.original}</p>}
                      <p className="whitespace-pre-line text-[var(--text-dark)]">{renderRich(s.suggested)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {done ? (
                        <span className="text-[11px] font-medium text-emerald-600">✓ 已应用</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className="rounded-lg bg-[var(--accent-strong)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#457C74]"
                        >
                          应用
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDismissed((p) => new Set(p).add(s.path))}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--chip-bg)]"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                )
              })}
            {!suggestBusy && pendingSuggestions.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[var(--card-bg)] px-3 py-2.5">
                <span className="text-[11px] text-[var(--text-tertiary)]">逐条确认，或一次性应用全部建议（都可撤销）</span>
                <button
                  type="button"
                  onClick={applyAll}
                  className="text-xs font-medium text-[var(--accent-text)] hover:underline"
                >
                  全部应用
                </button>
              </div>
            )}
            {!suggestBusy && (
              <button
                type="button"
                onClick={() => void fetchSuggestions()}
                className="self-start text-xs font-medium text-[var(--accent-text)] hover:underline"
              >
                ↻ 重新体检
              </button>
            )}
          </div>
        )}

        {/* ===== 对话改进 ===== */}
        {tab === 'chat' && (
          <div className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto px-6 py-4" ref={logRef}>
            {bubbles.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
                  {section
                    ? `你正在优化「${section.label}」，当前内容：${sectionContent(section.key, data).slice(0, 120)}…`
                    : '直接说想怎么改，AI 会更新右侧简历（可撤销）。'}
                  也可以试试：
                </p>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="self-start rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {bubbles.map((b, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  b.role === 'user'
                    ? 'self-end bg-[var(--accent-strong)] text-white'
                    : 'self-start bg-[var(--card-bg)] text-[var(--text-dark)]'
                }`}
              >
                {b.text}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 self-start rounded-2xl bg-[var(--card-bg)] px-3.5 py-2.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
                <span className="ml-1 text-[11px] text-[var(--text-tertiary)]">DeepSeek 正在优化…</span>
              </div>
            )}
          </div>
        )}

        {/* 输入区（对话改进） */}
        {tab === 'chat' && (
          <div className="flex items-end gap-2 border-t border-[var(--border-subtle)] px-6 py-3.5">
            <textarea
              value={input}
              placeholder={section ? `要怎么改进「${section.label}」？` : '例如：把第二段工作经历改得更量化…'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              className="h-[64px] min-w-0 flex-1 resize-none rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs leading-[18px] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="h-[64px] shrink-0 rounded-lg bg-[var(--accent-strong)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#457C74] disabled:opacity-50"
            >
              发送
            </button>
          </div>
        )}

        {/* 撤销 */}
        {prevSnapshot && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-2.5">
            <span className="text-[11px] text-[var(--text-tertiary)]">对 AI 的修改不满意？可以一键还原</span>
            <button type="button" onClick={onUndo} className="text-xs font-medium text-[var(--accent-text)] hover:underline">
              撤销上次 AI 修改
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
