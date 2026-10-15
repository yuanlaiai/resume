import type { JobProject, ResumeData } from '../types'

/**
 * DeepSeek API 客户端（浏览器直连，api.deepseek.com 已开放 CORS）：
 * 1. AI 核对：导入后先修复代码抽取文本的乱码/断行/噪声，降低错误率
 * 2. AI 智能解析：把核对后的原文交给 DeepSeek 结构化，比规则解析更稳
 * 3. AI 改进简历：对话式发送改进要求，模型返回优化后的完整简历 JSON
 * API Key 优先取浏览器 localStorage（AI 助手里手动填写），否则回退到构建时注入的
 * 环境变量 VITE_DEEPSEEK_API_KEY；不经过任何中间服务器，浏览器直连 api.deepseek.com。
 */

const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'
const KEY_STORE = 'resume-io-deepseek-key'

/** Key 来源优先级：浏览器内手动填写（localStorage）> 项目环境变量 VITE_DEEPSEEK_API_KEY（构建时注入） */
export function loadApiKey(): string {
  try {
    const local = localStorage.getItem(KEY_STORE)
    if (local) return local
  } catch {
    // 隐私模式下 localStorage 不可用，落到环境变量
  }
  return import.meta.env.VITE_DEEPSEEK_API_KEY ?? ''
}

export function saveApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORE, key)
    else localStorage.removeItem(KEY_STORE)
  } catch {
    // 隐私模式下 localStorage 不可用，忽略（本次会话仍可使用）
  }
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 基础对话：返回模型回复文本 */
export async function dsChat(messages: ChatMsg[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  const key = loadApiKey()
  if (!key) throw new Error('未检测到 DeepSeek API Key：请在 AI 助手中填写，或在项目 .env 配置 VITE_DEEPSEEK_API_KEY')
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      }),
    })
  } catch {
    throw new Error('无法连接 DeepSeek 服务，请检查网络')
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('DeepSeek API Key 无效，请检查后重新填写')
    if (res.status === 402) throw new Error('DeepSeek 账户余额不足，请充值后重试')
    if (res.status === 429) throw new Error('请求过于频繁，请稍后再试')
    const body = await res.text().catch(() => '')
    throw new Error(`DeepSeek 请求失败（${res.status}）${body.slice(0, 120)}`)
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content ?? ''
}

/** 从模型回复中宽松地抽取 JSON（容忍 ```json 围栏与前后闲话） */
function parseJsonLoose(text: string): Record<string, unknown> {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : text
  const start = raw.search(/[{[]/)
  if (start === -1) throw new Error('AI 返回内容无法解析')
  return JSON.parse(raw.slice(start)) as Record<string, unknown>
}

const asStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** 工作经历下的项目条目（项目制简历：公司 + 职位 下面挂 项目一/二/三） */
function jobProjectsFrom(v: unknown): JobProject[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = (v as Record<string, unknown>[])
    .map((p) => ({
      name: asStr(p.name),
      role: asStr(p.role),
      period: asStr(p.period),
      desc: asStr(p.desc),
      tech: asStr(p.tech) || undefined,
      duties: asStr(p.duties) || undefined,
      result: asStr(p.result) || undefined,
    }))
    .filter((p) => p.name || p.desc)
    .slice(0, 6)
  return out.length > 0 ? out : undefined
}

/** 把 AI 返回的任意 JSON 收敛为安全的 ResumeData 局部数据 */
function normalizeResume(obj: Record<string, unknown>): Partial<ResumeData> {
  const out: Partial<ResumeData> = {}
  const strFields = ['name', 'intent', 'years', 'city', 'phone', 'email', 'school', 'eduMajor', 'eduPeriod', 'summary'] as const
  for (const f of strFields) {
    const v = asStr(obj[f])
    if (v) (out as Record<string, unknown>)[f] = v
  }
  if (Array.isArray(obj.skills)) {
    const skills = obj.skills.map((s) => asStr(s)).filter(Boolean).slice(0, 10)
    if (skills.length > 0) out.skills = skills
  }
  if (Array.isArray(obj.jobs)) {
    const jobs = (obj.jobs as Record<string, unknown>[])
      .map((j) => ({
        name: asStr(j.name) || undefined,
        company: asStr(j.company),
        role: asStr(j.role),
        period: asStr(j.period),
        desc: asStr(j.desc),
        tech: asStr(j.tech) || undefined,
        duties: asStr(j.duties) || undefined,
        result: asStr(j.result) || undefined,
        projects: jobProjectsFrom(j.projects),
      }))
      .filter((j) => j.name || j.company || j.role || j.desc || j.projects)
      .slice(0, 8)
    if (jobs.length > 0) out.jobs = jobs
  }
  if (Array.isArray(obj.projects)) {
    const projects = (obj.projects as Record<string, unknown>[])
      .map((p) => ({
        name: asStr(p.name),
        role: asStr(p.role),
        period: asStr(p.period),
        desc: asStr(p.desc),
        tech: asStr(p.tech) || undefined,
        duties: asStr(p.duties) || undefined,
        result: asStr(p.result) || undefined,
      }))
      .filter((p) => p.name || p.desc)
      .slice(0, 6)
    if (projects.length > 0) out.projects = projects
  }
  return out
}

/**
 * AI 核对抽取文本：代码从 PDF/Word 抽出的文字常有乱码、断行错位、页眉页脚噪声，
 * 先交给模型做一轮「只修复、不改写」的校对，再送结构化解析，显著降低错误率。
 * 失败时调用方直接回退原文，不影响导入流程。
 */
export async function aiCleanResumeText(rawText: string): Promise<string> {
  const sys = `你是简历文本校对引擎。用户会给出从 PDF/Word 代码抽取出的简历原文，它可能有以下问题，请你修复后输出干净的纯文本：
1. 修复乱码字符、被拆断的英文单词（如 "Java Scr ipt" → "JavaScript"）、错位的标点与空格
2. 修复错误的换行：同一句被硬切断的行合并；不同信息（公司、职位、时间、要点）之间恢复合理的换行
3. 删除与简历内容无关的噪声：页眉页脚、页码（如 第 1 页 / 共 2 页）、水印文字、文档生成器署名
4. 修正明显的识别错字（如 "上海" 识别成 "上海" 以外的形近字），仅在有充分把握时修正
硬性规则：绝不改写措辞、不增删任何事实内容、不总结不翻译，只做修复与清理；直接输出修复后的纯文本，不要任何解释、不要代码块围栏。`
  const text = await dsChat(
    [
      { role: 'system', content: sys },
      { role: 'user', content: rawText.slice(0, 14000) },
    ],
    { maxTokens: 4000 },
  )
  const cleaned = text.trim()
  // 模型空回复或异常短时视为核对失败，调用方回退原文
  return cleaned.length > rawText.length * 0.3 ? cleaned : rawText
}

/** AI 智能解析：简历原文 → 结构化字段 */
export async function aiParseResume(rawText: string): Promise<Partial<ResumeData>> {
  const sys = `你是简历解析引擎。把用户提供的简历原文解析为 JSON，字段结构：
{"name":"姓名","intent":"求职意向","years":"工作年限如 5 年经验","city":"所在城市","phone":"手机号","email":"邮箱","school":"学校名","eduMajor":"专业与学历，如 软件工程（本科）","eduPeriod":"起止时间","summary":"自我评价原文","skills":["技能特长原文，每行一条，保留原样不精简"],"jobs":[{"name":"项目名称（仅没有公司层的项目制简历填，其余留空）","company":"公司名","role":"职位 / 角色","period":"2019.08-至今","tech":"技术栈，无则省略","desc":"工作内容，每条一行用\\n分隔","duties":"核心职责，每条一行用\\n分隔","result":"工作成果，一行","projects":[{"name":"项目名称","role":"项目角色","period":"项目时间，无则省略","tech":"技术栈，无则省略","desc":"项目描述，每条一行用\\n分隔","duties":"核心职责，每条一行用\\n分隔","result":"项目成果，一行"}]}],"projects":[{"name":"项目名称","role":"担任角色","period":"项目时间","tech":"技术栈，无则省略","desc":"项目描述，每条一行用\\n分隔","duties":"核心职责，每条一行用\\n分隔","result":"项目成果，一行"}]}
规则：
- 缺失的字段返回空字符串或空数组，绝对不要编造内容
- skills 保留简历原文措辞（含「精通/熟悉」等），不要改写
- 简历结构识别（重要）：
  · 若「公司 + 职位 + 任职时间」下面还逐条写了「项目一 / 项目二 / 项目三」，则每条任职经历作为一个 jobs 条目，其名下项目全部放进该条目的 projects 数组；不要把它们拆成多个 jobs 条目
  · 若简历没有公司层、直接逐条罗列项目，则每个项目作为一个 jobs 条目，项目名称写入 name 字段，company 留空
  · 若简历用独立的「项目经历」区块，则放进顶层 projects 数组
- 「项目描述 / 工作内容」放 desc，「核心职责 / 岗位职责」放 duties，「项目成果 / 业绩」放 result，三者不要混在一起
- 所有 desc 与 duties：每条要点一行、以「- 」开头；去掉原文的 · - • 等符号；可为关键词加 **加粗**、为量化成果加 ==突出== 标记（每条 1-2 处，绝不编造数据）
- 区分工作经历与项目经历，公司名与职位不要混淆
- 只输出 JSON，不要输出其他内容`
  const text = await dsChat(
    [
      { role: 'system', content: sys },
      { role: 'user', content: rawText.slice(0, 12000) },
    ],
    { json: true, maxTokens: 4000 },
  )
  return normalizeResume(parseJsonLoose(text))
}

/** AI 改进简历：当前简历 + 用户指令 → 优化后的完整简历 JSON + 改进说明（scope 限定只优化某一块） */
export async function aiImproveResume(
  current: ResumeData,
  instruction: string,
  history: ChatMsg[] = [],
  scope?: string,
): Promise<{ data: ResumeData; note: string }> {
  const slim = { ...current, avatar: undefined }
  const sys = `你是资深简历优化顾问。用户会给出当前简历 JSON 与改进要求，你输出优化后的完整简历 JSON（字段结构与输入完全一致，额外在顶层加一个 "note" 字段用一句话说明改进点）。
要求：
1. 只优化文字表达：量化成果、动词开头、删除空话套话；不改动事实、公司名、学校、时间、联系方式
2. jobs[].desc / duties 与 projects[].desc / duties 保持每条要点一行的格式（\\n 分隔），每行以「- 」开头形成无序列表；tech、result 等字段保持原样
3. 可用富文本标记：关键词 **加粗**；最有说服力的量化成果或核心亮点 ==突出==（每段 1-2 处，不要滥用）；summary 同样可用
4. skills 是字符串数组，每个元素是一整行技能文本（与编辑器的分行文本一一对应），保持原文风格与措辞，不要无中生有、不要拆成单个技能词
5. 只输出 JSON，不要输出其他内容`
  const messages: ChatMsg[] = [
    { role: 'system', content: sys },
    ...history,
    {
      role: 'user',
      content: `${scope ? `【本轮只优化「${scope}」这一块，其余字段原样保留】\n` : ''}当前简历：\n${JSON.stringify(slim)}\n\n改进要求：${instruction}`,
    },
  ]
  const text = await dsChat(messages, { json: true, maxTokens: 4000 })
  const obj = parseJsonLoose(text)
  const note = asStr(obj.note) || '已按你的要求优化简历内容'
  const normalized = normalizeResume(obj)
  // 以当前简历为基底，仅覆盖 AI 返回的字段（头像等本地数据不丢）
  const merged: ResumeData = { ...current }
  const record = merged as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(normalized)) {
    record[k] = v
  }
  return { data: merged, note }
}

/* ================= AI 主动体检：给出可逐条确认的优化建议 ================= */

/** 一条优化建议：path 是可写回简历的字段路径（applyEdit 语法） */
export interface Suggestion {
  /** jobs.0.desc / projects.1.desc / summary 等 */
  path: string
  /** 位置说明，如「工作经历 1 · 成果描述」 */
  label: string
  original: string
  suggested: string
  /** 依据的优化原则 */
  reason: string
}

/** 简历优化方法论（提炼自 STAR 法则 / 招聘视角的业界共识），作为 AI 体检的审查规则 */
const RESUME_SKILL = `【简历优化规则】
1. 量化成果：每条经历要点尽量带数字（百分比、金额、用户量、时长、频次）。没有精确数据时用规模与频次表达（如「每周产出 5-7 篇」「管理 15-20 个客户」），但绝不编造数字——缺数据时用「【补充：具体数字】」占位提醒用户。
2. 强动词开头：剔除「负责/协助/参与/帮助/工作内容是」等弱表述，换「主导/搭建/推动/重构/统筹/策划/交付」等强动词，遵循「动宾 + 产出」结构。
3. 成就而非职责：每条要点回答「因为你的工作，什么改变了？」——写出结果与业务影响，而不是罗列日常工作。
4. STAR 结构：情境-任务-行动-结果，最终句子以行动开头、以量化结果收尾。
5. 高光前置：把最有说服力的要点放在每段经历的第一条。
6. 去除空话：「性格开朗、吃苦耐劳、善于沟通」等无证据的自我评价要么删掉、要么改写为有事实支撑的具体陈述。
7. 关键词：围绕求职意向岗位的核心技能词自然融入经历描述；关键词用 **加粗** 标记，最有说服力的量化成果或核心亮点用 ==突出== 标记（每段经历 1-2 处，不要滥用）。
8. 精炼：每条要点 1-2 行；近期经历 3-4 条要点，久远经历 1-2 条。`

const SUGGEST_PATH_RE =
  /^(summary|intent|(jobs|projects)\.\d+\.(name|desc|duties|result|tech|role|period)|jobs\.\d+\.projects\.\d+\.(name|desc|duties|result|tech|role|period))$/

/** AI 体检：扫描当前简历，返回最多 5 条可逐条确认的优化建议 */
export async function aiSuggestImprovements(current: ResumeData): Promise<Suggestion[]> {
  const slim = { ...current, avatar: undefined }
  const sys = `你是资深简历顾问，按下面的规则对简历做体检，找出最值得改进的地方。
${RESUME_SKILL}

输出 JSON：{"suggestions":[{"path":"字段路径","label":"位置说明","original":"原文","suggested":"修改后的完整文本","reason":"一句话说明依据了哪条规则"}]}
要求：
- path 只能取：summary、intent、jobs.序号.desc、jobs.序号.duties、jobs.序号.result、jobs.序号.role、jobs.序号.projects.序号.desc、jobs.序号.projects.序号.duties、jobs.序号.projects.序号.result、projects.序号.name、projects.序号.desc、projects.序号.duties、projects.序号.result（序号从 0 开始，对应当前简历 JSON 的数组下标）
- 最多 5 条，只挑提升最大的点，按重要性排序
- suggested 给出完整的替换文本（desc / duties 保持每条要点一行、以「- 」开头的 \\n 分隔格式；可为关键词加 **加粗**、为量化亮点加 ==突出== 标记）
- 不要改动事实、公司名、时间、联系方式
- 只输出 JSON`
  const text = await dsChat(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `当前简历：\n${JSON.stringify(slim)}` },
    ],
    { json: true, maxTokens: 3000 },
  )
  const obj = parseJsonLoose(text)
  if (!Array.isArray(obj.suggestions)) return []
  return (obj.suggestions as Record<string, unknown>[])
    .map((s) => ({
      path: asStr(s.path),
      label: asStr(s.label) || '简历内容',
      original: asStr(s.original),
      suggested: asStr(s.suggested),
      reason: asStr(s.reason),
    }))
    .filter((s) => s.suggested && SUGGEST_PATH_RE.test(s.path))
    .slice(0, 5)
}
