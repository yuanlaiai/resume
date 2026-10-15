import type { ResumeData } from '../types'

/**
 * 简历导入解析引擎（纯浏览器端，无后端）：
 * 1. PDF → pdf.js 抽取文本（不支持扫描图片型 PDF）
 * 2. Word (.docx) → mammoth 抽取纯文本
 * 3. 中文简历规则解析：联系方式 / 姓名 / 求职意向 / 工作经历 / 教育背景 / 技能 / 自我评价
 */

/* ============ 文本抽取 ============ */

export interface ExtractedResume {
  text: string
  /** 抽取到的证件照（data URL），可能为空 */
  photo?: string
}

export async function extractResume(file: File): Promise<ExtractedResume> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const buf = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data: buf }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // 按 y 坐标动态聚类成行（容差 4px），行内按 x 排序还原阅读顺序。
      // 真实 PDF 常因字号不同/双栏布局导致同一行 y 略有偏差、片段乱序；
      // 相邻片段水平间距明显大于一个字符宽（双栏单元格/左右分栏）时用「｜」分隔，
      // 供后续解析按 ｜ 拆分，避免两栏文字被空格粘连。
      const items = content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>
      const frags: Array<{ y: number; x: number; w: number; h: number; str: string }> = []
      for (const it of items) {
        if (!it.str || !it.transform || !it.str.trim()) continue
        frags.push({ y: it.transform[5], x: it.transform[4], w: it.width ?? 0, h: it.height ?? 10, str: it.str })
      }
      frags.sort((a, b) => b.y - a.y || a.x - b.x)
      const clusters: Array<{ y: number; parts: Array<{ x: number; w: number; h: number; str: string }> }> = []
      for (const f of frags) {
        const last = clusters[clusters.length - 1]
        if (last && Math.abs(last.y - f.y) <= 4) {
          last.parts.push(f)
        } else {
          clusters.push({ y: f.y, parts: [f] })
        }
      }
      const pageLines = clusters
        .map((c) => {
          const sorted = c.parts.sort((a, b) => a.x - b.x)
          let out = ''
          let prevEnd = -Infinity
          for (const p of sorted) {
            if (!out) {
              out = p.str
            } else {
              const gap = p.x - prevEnd
              // 栏间距阈值与字号成正比（约半个字高）：词间空格 ~0.3 字高，分栏/双列间隙明显更大
              const threshold = Math.max(4, p.h * 0.5)
              out += gap > threshold ? '｜' : ' '
              out += p.str
            }
            prevEnd = p.x + p.w
          }
          return out.replace(/\s+/g, ' ').trim()
        })
        .filter(Boolean)
      pages.push(pageLines.join('\n'))
    }
    // NFKC 归一化：部分 PDF 字体将中文映射为康熙部首码位（⼯/⾬/⻓），需转回标准汉字
    // （NFKC 只覆盖 U+2F00 康熙部首主块，U+2E80 部首补充块的简化部首（⻓⻔⻢等）需额外折叠）
    const text = radicalFold(pages.join('\n').normalize('NFKC'))
    // 照片：best-effort 抽取嵌入图像（失败不影响文本导入）
    const photo = await extractPdfPhoto(pdfjs, doc).catch(() => undefined)
    return { text, photo }
  }
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const buf = await file.arrayBuffer()
    // 纯文本与 HTML（含内嵌图片 data URI）并行抽取
    const [raw, html] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer: buf.slice(0) }),
      mammoth
        // 默认 convertImage 即 dataUri：内嵌图片以 <img src="data:..."> 输出
        .convertToHtml({ arrayBuffer: buf })
        .catch(() => ({ value: '' })),
    ])
    // 证件照：取文档中最大的内嵌图片（logo/装饰图通常更小）
    let photo: string | undefined
    let best = 0
    for (const m of (html.value || '').matchAll(/src="data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)"/g)) {
      if (m[2].length > best && m[2].length > 2000) {
        best = m[2].length
        photo = `data:${m[1]};base64,${m[2]}`
      }
    }
    return { text: raw.value.normalize('NFKC'), photo }
  }
  throw new Error('仅支持 PDF 或 Word (.docx) 文件')
}

/** 兼容旧调用：仅抽取文本 */
export async function extractText(file: File): Promise<string> {
  return (await extractResume(file)).text
}

/** 从 PDF 嵌入图像中提取证件照：扫描前 2 页的 paintImageXObject，渲染到 canvas 导出 */
async function extractPdfPhoto(pdfjs: typeof import('pdfjs-dist'), doc: Awaited<ReturnType<typeof import('pdfjs-dist').getDocument>['promise']>): Promise<string | undefined> {
  const candidates: Array<{ w: number; h: number; url: string }> = []
  const pagesToTry = Math.min(doc.numPages, 2)
  for (let p = 1; p <= pagesToTry; p++) {
    const page = await doc.getPage(p)
    const ops = await page.getOperatorList()
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue
      const name = ops.argsArray[i][0]
      try {
        const img = await new Promise<{ width?: number; height?: number; data?: Uint8ClampedArray; kind?: number; bitmap?: ImageBitmap } | null>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 3000)
          page.objs.get(name, (obj: unknown) => {
            clearTimeout(timer)
            resolve((obj ?? null) as never)
          })
        })
        if (!img || !img.width || !img.height || img.width < 80 || img.height < 80) continue
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        if (img.bitmap) {
          ctx.drawImage(img.bitmap, 0, 0)
        } else if (img.data) {
          const imageData = ctx.createImageData(img.width, img.height)
          const src = img.data
          const dst = imageData.data
          const px = img.width * img.height
          if (src.length === px * 3) {
            // RGB 24 位
            for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
              dst[k] = src[j]
              dst[k + 1] = src[j + 1]
              dst[k + 2] = src[j + 2]
              dst[k + 3] = 255
            }
          } else if (src.length === px * 4) {
            dst.set(src)
          } else {
            continue
          }
          ctx.putImageData(imageData, 0, 0)
        } else {
          continue
        }
        candidates.push({ w: img.width, h: img.height, url: canvas.toDataURL('image/jpeg', 0.92) })
      } catch {
        // 单张图片抽取失败忽略
      }
    }
  }
  if (candidates.length === 0) return undefined
  // 优先竖版（证件照宽高比约 0.6~0.9）中面积最大的一张
  const portrait = candidates.filter((c) => {
    const r = c.w / c.h
    return r > 0.5 && r < 0.95
  })
  const pool = portrait.length > 0 ? portrait : candidates
  pool.sort((a, b) => b.w * b.h - a.w * a.h)
  return pool[0].url
}

/* ============ 字段解析 ============ */

/**
 * CJK 部首补充块（U+2E80–U+2EFF）折叠映射：部分 PDF 字体把正文汉字编码为该块的
 * 简化部首（如「技能特⻓」的 ⻓、双栏里的 ⻔⻢⻋），NFKC 只还原 U+2F00 康熙部首主块，
 * 覆盖不到这里，需手工映射回常用简体字。
 */
const RADICAL_MAP: Record<string, string> = {
  '\u2EC5': '见', '\u2EC6': '角', '\u2EC9': '贝', '\u2ECB': '车', '\u2ED3': '长', '\u2ED4': '门',
  '\u2ED8': '青', '\u2ED9': '韦', '\u2EDA': '页', '\u2EDB': '风', '\u2EDC': '飞', '\u2EDD': '食',
  '\u2EE2': '马', '\u2EE4': '鬼', '\u2EE5': '鱼', '\u2EE6': '鸟', '\u2EE8': '麦', '\u2EE9': '黄',
  '\u2EEB': '齐', '\u2EEE': '齿', '\u2EF0': '龙', '\u2EF3': '龟', '\u2ECA': '足',
}
const RADICAL_RE = new RegExp(`[${Object.keys(RADICAL_MAP).join('')}]`, 'g')
/** 部首折叠（幂等，可在抽取与解析两端重复调用） */
export const radicalFold = (s: string) => s.replace(RADICAL_RE, (c) => RADICAL_MAP[c] ?? c)

const RESUME_KEYWORDS = /简历|resume|curriculum|^个人简介$/i

const SECTION_PATTERNS: Array<{ key: string; re: RegExp }> = [
  {
    key: 'work',
    re: /^(工作经历|职业经历|工作经验|实习经历|工作履历|任职经历|工作背景|职业发展|从业经历|工作情况)/,
  },
  { key: 'edu', re: /^(教育背景|教育经历|学历信息|教育信息|学业经历|教育|学历)/ },
  {
    key: 'skills',
    re: /^(技能特长|专业技能|核心技能|个人技能|技能|IT\s*技能|IT技能|职业能力|专长|特长)/,
  },
  {
    key: 'summary',
    re: /^(自我评价|个人评价|个人总结|关于我|个人优势|自我描述|自我介绍|个人简介|评价)/,
  },
  { key: 'project', re: /^(项目经历|项目经验|实践经历|校园经历|社团经历)/ },
]

const PERIOD_RE =
  /(\d{4}\s*[.\-/年]\s*(\d{1,2})?\s*[.\-/月]?\s*[-–—~至到]{1,2}\s*(\d{4}\s*[.\-/年]\s*(\d{1,2})?\s*[.\-/月]?|至今|现在|now|present|今))/i

const ROLE_SRC =
  '工程师|开发|前端|后端|算法|测试|运维|架构|产品|项目经理|运营|市场|增长|设计|视觉|交互|UI|UX|UED|经理|主管|总监|专员|助理|实习|分析|数据|会计|财务|销售|客户|咨询|顾问|教师|老师|编辑|记者|文案|策划|行政|人事|人力|法务|医|护理|律师|翻译|采购|物流|供应链|质量'
const ROLE_RE = new RegExp(ROLE_SRC)

const COMPANY_RE = /公司|集团|控股|科技|银行|事业部|工作室|事务所|传媒|研究院|研究所|医院|中心/

/** 动词开头的行是职责描述，不是公司/职位名 */
const VERB_RE =
  /^(负责|主导|参与|协助|搭建|推动|输出|制定|管理|带领|完成|跟进|统筹|规划|优化|对接|支持|通过|利用|基于|熟悉|精通|拥有|任职|担任)/

/** 工作描述里的小标题行（「工作内容：」等）——不属于要点，丢弃 */
const SUBHEAD_RE =
  /^(工作内容|工作职责|岗位职责|主要职责|职责描述|职位描述|工作描述|主要工作|工作职能|任职要求|任职资格|主要业绩|工作业绩|业绩描述|项目职责)[:：]?$/

/** 职位中段的职能 / 技术修饰词（可连用 0~3 段：「高级软件开发工程师」= 高级 + 软件·开发 + 工程师） */
const ROLE_MID_SRC =
  '产品|项目|运营|市场|增长|品牌|设计|视觉|交互|用户|数据|算法|测试|开发|研发|前端|后端|全栈|架构|分析|商业|财务|会计|审计|销售|客户|咨询|内容|文案|行政|人事|人力|法务|合规|翻译|采购|物流|供应链|质量|风控|运维|医学|护理|渠道|海外|国际|区域|商务|技术|软件|硬件|系统|平台|服务|应用|云|网络|安全|智能|自动化|信息化|数字化|嵌入式|移动|游戏|音视频|图像|推荐|搜索|广告|工程|实施|交付|售前|售后|支撑|支持|管理|经营|投资|融资|战略|组织|人才'

/**
 * 完整职位词全匹配（「高级产品经理」✓「司高级产品经理」✗——避免把公司名碎片切进职位）。
 * 中段只允许「职能/技术词表」的 0~3 次连用：既能容纳「高级软件开发工程师」，
 * 又不会像通配中文那样把「控股」这类公司名碎片吞进职位。
 */
const ROLE_FULL_RE = new RegExp(
  `^(?:(?:高级|资深|中级|初级|首席|副|总|助理|实习|执行|见习|储备)?(?:(?:${ROLE_MID_SRC}){0,3})(?:经理|总监|主管|专员|助理|工程师|分析师|设计师|架构师|规划师|策划|顾问|律师|教师|老师|编辑|记者|翻译|采购|会计|审计|研究员|专家|代表|主任|负责人))$`,
)

/** 机构名后缀词（用于定位「公司 | 职位」的切分点） */
const COMPANY_SUFFIX_SRC = '公司|集团|控股|科技|银行|事业部|工作室|事务所|传媒|研究院|研究所|医院|中心|学院|大学'

/** 从行尾切出职位（中文字间伪空格归一化会把「公司 职位」融合，这里按机构后缀 + 完整职位词还原） */
function splitTailRole(s: string): { company?: string; role?: string } | null {
  // 1) 优先在最后一个机构后缀词之后切分：「明求数据科技有限公司高级产品经理」→ 公司 + 高级产品经理
  const suffixRe = new RegExp(COMPANY_SUFFIX_SRC, 'g')
  let m: RegExpExecArray | null
  let bestEnd = -1
  while ((m = suffixRe.exec(s))) {
    bestEnd = Math.max(bestEnd, m.index + m[0].length)
    suffixRe.lastIndex = m.index + 1
  }
  if (bestEnd > 0) {
    const company = s.slice(0, bestEnd)
    const role = s.slice(bestEnd)
    if (company.length >= 2 && role.length >= 2 && role.length <= 12 && ROLE_FULL_RE.test(role)) {
      return { company: clean(stripLabel(company)), role }
    }
  }
  // 2) 无机构后缀（如「字节跳动资深产品经理」）：从尾部找完整匹配职位词的最长后缀
  for (let len = Math.min(12, s.length); len >= 2; len--) {
    const role = s.slice(s.length - len)
    if (!ROLE_FULL_RE.test(role)) continue
    const company = s.slice(0, s.length - len).trim()
    if (company.length >= 2) return { company: clean(stripLabel(company)), role }
    if (company.length === 0) return { role }
  }
  return null
}

/** 清理字段值两端的分隔符 */
const clean = (s: string) => s.replace(/^[\s:：,，、;；|｜·\-–—]+|[\s:：,，、;；|｜·]+$/g, '').trim()

/** 常用中英文字符（含全角标点）——用于去除 PDF 抽取产生的字间伪空格 */
const CJK_CLASS = '[\\u4e00-\\u9fa5\\u3001\\u3002\\uff08\\uff09\\uff1a\\uff1b\\uff0c\\u00b7\\uff0e]'
const CJK_SPACE_RE = new RegExp(`(?<=${CJK_CLASS})[ \\t]+(?=${CJK_CLASS})`, 'g')
/** 去除中文字符之间的伪空格（「陈墨 白」→「陈墨白」，不影响中英之间的正常空格） */
const normalizeCjk = (s: string) => s.replace(CJK_SPACE_RE, '')

/** 已知字段 KV 应用；命中返回 true */
function applyKV(header: Record<string, string>, label: string, value: string): boolean {
  if (!value) return false
  if (/^(姓名|name)$/i.test(label)) {
    header.name = value
    return true
  }
  if (/求职意向|意向岗位|意向职位|应聘职位|应聘岗位|求职岗位|目标职位|期望职位/i.test(label)) {
    header.intent = value
    return true
  }
  if (/^(电话|手机|联系方式|tel|mobile|phone)$/i.test(label)) {
    header.phone = value
    return true
  }
  if (/^(邮箱|电子邮件|e-?mail|邮件)$/i.test(label)) {
    header.email = value
    return true
  }
  if (/^(工作年限|工作经验|工作年数|从业年限|年资)$/.test(label)) {
    header.years = value
    return true
  }
  if (/^(城市|所在城市|工作城市|工作地点|现居|现居城市|现居住地|居住地|所在地|坐标)$/.test(label)) {
    header.city = value
    return true
  }
  return false
}

interface Section {
  key: string
  title: string
  lines: string[]
}

interface SplitResult {
  header: Record<string, string>
  /** 第一个区块标题之前的所有自由行（通常含姓名、联系方式） */
  headerLines: string[]
  sections: Section[]
}

/** 按区块标题切分行 */
function splitSections(lines: string[]): SplitResult {
  const header: Record<string, string> = {}
  const headerLines: string[] = []
  const sections: Section[] = []
  let current: Section | null = null

  /** 全局扫描「标签：值」对（PDF 抽取常把多个 KV 压成一行、冒号为半角、间隔单空格）。
      命中后只剔除命中的 KV 片段并返回残余文本——姓名常与联系方式挤在同一行，
      不能因为行里有 KV 就把整行吞掉，否则姓名丢失。 */
  const tryKVs = (line: string): string | null => {
    if (!/[:：]/.test(line)) return null
    // 值内的中文字间伪空格（「高 级 后 端 工 程 师」）先归一化，避免在首个空格处截断
    const cjkJoined = normalizeCjk(line)
    const re = /([\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z\s]{0,10}|[A-Za-z][A-Za-z\s-]{0,10})\s*[:：]\s*([^\s:：]{1,60})/g
    const spans: Array<[number, number]> = []
    let hit = false
    for (const m of cjkJoined.matchAll(re)) {
      const label = m[1].replace(/[\s（）()]/g, '')
      if (applyKV(header, label, clean(m[2]))) {
        hit = true
        spans.push([m.index!, m.index! + m[0].length])
      }
    }
    if (!hit) return null
    // 从后往前剔除命中的 KV 片段，残余行继续走标题/姓名识别
    let residual = cjkJoined
    for (let i = spans.length - 1; i >= 0; i--) {
      residual = residual.slice(0, spans[i][0]) + ' ' + residual.slice(spans[i][1])
    }
    return clean(residual)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const kvResidual = tryKVs(line)
    if (kvResidual !== null) {
      // 行内命中 KV：残余仍有内容则继续处理（可能含姓名），整行被 KV 覆盖则跳过
      if (!kvResidual) continue
      // 归一化已在 tryKVs 内完成，残余直接进入标题/姓名流程
      const normResidual = kvResidual
      // 残余命中区块标题（如「个人信息：李知远」被剔除后残余是标题）
      const squashedR = stripSectionMark(normResidual.replace(/\s+/g, ''))
      const secR = SECTION_PATTERNS.find((p) => p.re.test(squashedR) && squashedR.length <= 20)
      if (secR) {
        const kwR = squashedR.match(secR.re)![0]
        const inlineR = squashedR.slice(kwR.length).replace(/^[：:、.．\-—–—·•)\]）\s]+/, '')
        current = { key: secR.key, title: normResidual, lines: inlineR ? [inlineR] : [] }
        sections.push(current)
        continue
      }
      if (current) current.lines.push(normResidual)
      else headerLines.push(normResidual)
      continue
    }

    // 去除中文字间伪空格（「工 作经历」→「工作经历」），再做标题匹配
    const norm = normalizeCjk(line)
    // 剥离前导序号（01. / 4、/ 四、）与装饰符号（◆ ■ ★ ①）
    const squashed = stripSectionMark(norm.replace(/\s+/g, ''))
    const sec = SECTION_PATTERNS.find((p) => p.re.test(squashed) && squashed.length <= 20)
    if (sec) {
      const kw = squashed.match(sec.re)![0]
      const rest = squashed.slice(kw.length)
      // 裸 2 字泛词（技能/特长/评价/教育/学历）仅在整行仅标题时才算区块标题，
      // 避免「技能全面，责任心强」这类正文句子被误判为新区块
      const bare = /^(技能|特长|评价|教育|学历)$/.test(kw)
      if (bare && rest) {
        // 不算标题，落入当前区块
      } else {
        // 「个人技能 Java、Python」式标题带内联内容：归入新区块，不丢字
        const inline = rest.replace(/^[：:、.．\-—–—·•)\]）\s]+/, '')
        current = { key: sec.key, title: norm, lines: inline ? [inline] : [] }
        sections.push(current)
        continue
      }
    }
    // 「个人技能：Java、Python」式「标题：内容」同行：标题段（冒号前）命中即可，不限整行长度
    if (!sec) {
      const colonIdx = squashed.search(/[：:]/)
      if (colonIdx > 0) {
        const headPart = squashed.slice(0, colonIdx)
        const sec2 = SECTION_PATTERNS.find((p) => p.re.test(headPart))
        if (sec2) {
          const inline = squashed.slice(colonIdx + 1)
          current = { key: sec2.key, title: norm, lines: inline ? [inline] : [] }
          sections.push(current)
          continue
        }
      }
    }
    if (current) current.lines.push(norm)
    else headerLines.push(norm)
  }
  return { header, headerLines, sections }
}

/** 提取联系方式（标签式已处理，这里兜底正则扫描全文） */
function extractContact(lines: string[], header: Record<string, string>): { phone?: string; email?: string } {
  let phone = header.phone
  let email = header.email
  const all = lines.join('\n')
  if (!phone) {
    const m = all.replace(/[\s\-–—]/g, '').match(/1[3-9]\d{9}/)
    if (m) phone = m[0]
  }
  if (!email) {
    const m = all.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
    if (m) email = m[0]
  }
  return { phone, email }
}

/** 姓名识别：标签值 → 整行姓名（含伪空格拆字）→ 混排行拆段 → 单字拼接 */
function extractName(header: Record<string, string>, headerLines: string[]): string | undefined {
  if (header.name) return header.name
  const blacklist =
    /^(男|女|汉|汉族|未婚|已婚|本科|硕士|大专|专科|博士|研究生|党员|团员|群众|共青团员|个人简历|求职简历|中文简历|英文简历|个人简介|自我评价|教育背景|工作经历)$/
  const okName = (t: string) =>
    t.length >= 2 &&
    t.length <= 5 &&
    /^[·\u4e00-\u9fa5]+$/.test(t) &&
    !blacklist.test(t) &&
    !RESUME_KEYWORDS.test(t) &&
    !ROLE_RE.test(t) &&
    !/(岁|经验|大学|学院|邮箱|电话|城市|北京|上海|广州|深圳)/.test(t)
  // 1) 整行即姓名：PDF 抽取常把姓名拆成「李 知 远」，去空格后 2-4 字纯中文 → 直接命中
  for (const line of headerLines.slice(0, 4)) {
    const squashed = line.replace(/\s+/g, '')
    if (/^[·\u4e00-\u9fa5]{2,5}$/.test(squashed) && okName(squashed)) return squashed
  }
  // 2) 混排行拆段（「张三 | 男 | 25岁」「张三·13800112233」「李知远丨高级前端工程师」）
  for (const line of headerLines) {
    const parts = line.split(/[|｜,，/／\s丨・―–—_]+/)
    for (const p of parts) {
      const t = clean(p)
      if (okName(t)) return t
      // 段内伪空格姓名（「王 小明」→「王小明」）
      const sq = t.replace(/\s+/g, '')
      if (sq !== t && sq.length >= 2 && sq.length <= 4 && /^[·\u4e00-\u9fa5]+$/.test(sq) && okName(sq)) return sq
    }
  }
  // 3) 兜底：前几行被伪空格拆成单字的姓名（「李 知 远」split 后每段 1 字），逐字扫描拼接
  const chars: string[] = []
  for (const line of headerLines.slice(0, 3)) {
    const parts = line.split(/\s+/)
    if (parts.length < 2 || parts.length > 4) {
      chars.length = 0
      continue
    }
    if (parts.every((p) => /^[\u4e00-\u9fa5]$/.test(p))) return parts.join('')
    chars.length = 0
  }
  return undefined
}

/** 去前导序号：「01. 拼多多」「3、字节跳动」「四、腾讯」→ 机构名 */
const stripOrdinal = (s: string): string =>
  s
    .replace(/^[\s0-9０-９]{1,2}\s*[.、．)）]\s*/, '') // 阿拉伯数字序号（限 1-2 位，避免吃掉年份）
    .replace(/^[一二三四五六七八九十]{1,2}\s*[、.．)）]\s*/, '') // 中文序号
    .replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '') // 「◆ ■ ★ ①」等装饰符号

/** 去除常见字段标签前缀（「公司：腾讯」→「腾讯」） */
const stripLabel = (s: string) =>
  stripOrdinal(s).replace(/^(公司名称|公司|单位|企业|机构|职位名称|职位|岗位|职务|部门)[:：]\s*/, '')

/** 区块标题去前导序号与装饰符号（「01.个人技能」「四、个人评价」→「个人技能」） */
const stripSectionMark = stripOrdinal

/* ---------- 项目制经历的子字段标签（技术栈 / 项目描述 / 核心职责 / 项目成果） ---------- */

/** 经历条目内部的归类模式 */
type EntryField = 'name' | 'company' | 'tech' | 'desc' | 'duties' | 'result'

/**
 * 「标签：值」形式可安全归类的标签词。
 * 只收明确指向该含义的词——「工作内容」「主要工作」这类泛词会误伤普通简历（它们本该留在描述里），
 * 因此不在此列。
 */
const FIELD_KV_LABELS: Array<{ field: EntryField; re: RegExp }> = [
  { field: 'name', re: /^(项目名称|项目名|项目主题|项目标题)$/ },
  { field: 'company', re: /^(公司名称|公司|工作单位|单位|企业名称|企业|就职公司|所在公司)$/ },
  { field: 'tech', re: /^(技术栈|技术选型|开发环境|运行环境|技术架构|技术方案|涉及技术|使用技术|相关技术|核心技术|技术工具|技术要点|开发工具)$/ },
  { field: 'duties', re: /^(核心职责|岗位职责|工作职责|主要职责|项目职责|职责描述|职责概述)$/ },
  { field: 'result', re: /^(项目成果|项目业绩|工作成果|项目产出|项目收益|项目价值|项目成就|项目亮点|项目成效)$/ },
  { field: 'desc', re: /^(项目描述|项目简介|项目背景|项目介绍|项目概述|项目说明)$/ },
]

/** 独立成行的小标题（无冒号）：项目制简历里靠它切换后续要点的归属 */
const FIELD_HEADING_LABELS: Array<{ field: EntryField; re: RegExp }> = [
  ...FIELD_KV_LABELS,
  { field: 'duties', re: /^(职责|核心工作内容|主要工作内容|项目内容|负责内容)$/ },
  { field: 'result', re: /^(成果|业绩|产出|成效)$/ },
  { field: 'desc', re: /^(项目主要内容)$/ },
]

/**
 * 识别经历条目内的子字段标签。
 * 支持两种写法：「核心职责：xxx」（同行带值）与「核心职责」（独占一行的小标题，值为空）。
 * 不匹配返回 null，保证普通简历文本不受影响。传入的文本须保留行尾冒号。
 * exclude：需要排除的字段（项目经历有独立的「项目名称 / 角色」归属逻辑，不接受它们走通配标签）。
 */
function matchFieldLabel(bare: string, exclude?: readonly EntryField[]): { field: EntryField; value: string } | null {
  const m = bare.match(/^([^：:]{2,10})\s*[:：]\s*([\s\S]*)$/)
  if (m) {
    const label = m[1].replace(/\s+/g, '')
    for (const { field, re } of FIELD_KV_LABELS) {
      if (exclude?.includes(field)) continue
      if (re.test(label)) return { field, value: clean(m[2]) }
    }
    return null
  }
  const head = bare.replace(/\s+/g, '')
  for (const { field, re } of FIELD_HEADING_LABELS) {
    if (exclude?.includes(field)) continue
    if (re.test(head)) return { field, value: '' }
  }
  return null
}

/** 「项目一：企业级 AI 知识库」/「案例 2、XX 平台」→ 条目标题（去掉序号前缀） */
const ENTRY_ORDINAL_RE = /^(?:项目|案例|课题|产品)\s*(?:[一二三四五六七八九十百]{1,3}|\d{1,3})\s*[:：、.]\s*(.*)$/

/** 经历条目累积器（rule 解析中间态） */
interface EntryAcc {
  period: string
  desc: string[]
  tech: string
  duties: string[]
  result: string[]
  /** 项目名称（项目制简历） */
  name?: string
  /** 公司 / 单位 */
  company?: string
}

/** 把续行追加到指定子字段（tech/name/company 单行拼接，其余按要点列表化） */
function appendField(acc: EntryAcc, field: EntryField, value: string) {
  const t = clean(value)
  if (!t) return
  const line = t.replace(/^[·•\-–—*]\s*/, '')
  if (field === 'tech') acc.tech = acc.tech ? `${acc.tech} ${line}` : line
  else if (field === 'name') acc.name = acc.name ? `${acc.name} ${line}` : line
  else if (field === 'company') acc.company = acc.company ? `${acc.company} ${line}` : line
  else if (field === 'duties') acc.duties.push(`· ${line}`)
  else if (field === 'result') acc.result.push(line)
  else acc.desc.push(`· ${line}`)
}

/** 把累积的子字段收敛为可渲染的富文本（空字段返回 undefined） */
function foldEntryFields(acc: EntryAcc, allowHighlight = true) {
  return {
    tech: acc.tech ? acc.tech.replace(/\s+/g, ' ').slice(0, 200) : undefined,
    duties: acc.duties.length > 0 ? autoStyleDesc(acc.duties.join('\n'), false) : undefined,
    result: acc.result.length > 0 ? autoStyleDesc(acc.result.join('\n'), allowHighlight) : undefined,
  }
}

/** 把一段经历头行拆成 公司 + 职位 */
function splitJobLine(line: string): { company?: string; role?: string } {
  // 含明确分隔符（制表符 / 竖线 / 中点 / 全角空格 / 连续空格）的表格化排版：
  // 按段归类。「传音控股\t高级软件开发工程师」不该走尾部切分（会被切成「传音控股高级软件」+「开发工程师」）
  if (/[\t|｜·・]|\u3000|\s{2,}/.test(line)) {
    const segs = line
      .split(/[\t|｜·・\u3000]+|\s{2,}/)
      .map((x) => clean(stripLabel(x)))
      .filter((x) => x && !PERIOD_RE.test(x) && !/^\d{4}/.test(x))
    if (segs.length >= 2) {
      let company: string | undefined
      let role: string | undefined
      for (const st of segs) {
        if (st.length > 28) continue
        if (!company && COMPANY_RE.test(st)) company = st
        else if (!role && ROLE_RE.test(st) && !COMPANY_RE.test(st)) role = st
      }
      for (const st of segs) {
        if (st.length > 28 || st === company || st === role) continue
        if (!company) company = st
        else if (!role) role = st
      }
      if (company && role && company === role) role = undefined
      if (company || role) return { company, role }
    }
  }

  const s = stripLabel(clean(line))
  if (!s) return {}
  // 优先：行尾职位切分（处理「公司职位」被伪空格归一化融合的情况）
  const tail = splitTailRole(s)
  if (tail) return tail

  const segs = s
    .split(/[|｜·・/／,，、\u3000]+|\s+/)
    .map(clean)
    .filter((st) => st && !PERIOD_RE.test(st) && !/^\d{4}/.test(st))
  let company: string | undefined
  let role: string | undefined
  for (const st of segs) {
    if (st.length > 24) continue
    // 公司优先判定：含机构关键词的一定是公司（避免「XX数据科技有限公司」因含「数据」被误判为职位）
    if (!company && COMPANY_RE.test(st)) {
      company = st
    } else if (!role && ROLE_RE.test(st) && !COMPANY_RE.test(st)) {
      role = st
    } else if (!company && st.length >= 2) {
      company = st
    }
  }
  if (company && role && company === role) role = undefined
  if (!company && segs.length > 0) company = segs[0]
  return { company, role }
}

/** 工作经历：按时间行切段；缺公司/职位时从要点行里回捞 */
function parseJobs(lines: string[]): ResumeData['jobs'] {
  type ProjAcc = EntryAcc & { role?: string }
  type Acc = EntryAcc & { role?: string; projects?: ProjAcc[] }
  const jobs: Acc[] = []
  let cur: Acc | null = null
  /** 当前正在填充的项目（「公司 + 职位」下面挂的 项目一 / 项目二 …） */
  let proj: ProjAcc | null = null
  /** 当前要点的归属字段（碰到「核心职责」「项目成果」等小标题时切换） */
  let mode: EntryField = 'desc'

  // 预处理：去空行；可归类的子字段小标题保留（作为归属切换标记），其余纯小标题丢弃；
  // 纯时间行与相邻的「公司/职位」短行合并为一个头行
  const kept: string[] = []
  for (const line of lines) {
    const t = clean(line)
    if (!t) continue
    const bare = t.replace(/^[·•\-–—*]\s*/, '').trim()
    if (SUBHEAD_RE.test(t) && !matchFieldLabel(bare)) continue
    kept.push(line.trim()) // 保留 ·/- 前缀，供后面判断要点行
  }
  /** 子字段标签行不是「公司/职位」候选，避免被合并进头行 */
  const isLabelLine = (s: string) => !!matchFieldLabel(s.replace(/^[·•\-–—*]\s*/, '').trim())
  const isHeadish = (s: string | undefined): s is string =>
    !!s &&
    !PERIOD_RE.test(s) &&
    !/^[·•-]/.test(s) &&
    !VERB_RE.test(s) &&
    !isLabelLine(s) &&
    !ENTRY_ORDINAL_RE.test(s.replace(/^[·•\-–—*]\s*/, '').trim()) &&
    s.length >= 2 &&
    s.length <= 20 &&
    !/[。！？，]/.test(s)
  const merged: string[] = []
  for (let i = 0; i < kept.length; i++) {
    const line = kept[i]
    const pm = line.match(PERIOD_RE)
    if (pm && line.replace(pm[0], '').trim() === '') {
      const prev = merged[merged.length - 1]
      // 「公司 职位」在前、纯时间行在后 → 向前合并
      if (prev && isHeadish(prev.replace(/^[·•-]\s*/, '')) && prev.length <= 30) {
        merged[merged.length - 1] = `${prev} ${line}`
        continue
      }
      // 纯时间行在前、公司/职位独行在后（最多两行）→ 向后合并
      const next1 = kept[i + 1]
      const next2 = kept[i + 2]
      if (isHeadish(next1)) {
        if (isHeadish(next2)) {
          merged.push(`${line} ${next1} ${next2}`)
          i += 2
          continue
        }
        merged.push(`${line} ${next1}`)
        i += 1
        continue
      }
    }
    merged.push(line)
  }

  const newAcc = (init: Partial<Acc> = {}): Acc => ({ period: '', desc: [], tech: '', duties: [], result: [], ...init })
  const newProj = (init: Partial<ProjAcc> = {}): ProjAcc => ({ period: '', desc: [], tech: '', duties: [], result: [], ...init })
  /** 当前写入目标：正在填充某个项目时归项目，否则归经历本身 */
  const sink = (): EntryAcc | null => proj ?? cur

  for (const line of merged) {
    const pm = line.match(PERIOD_RE)
    if (pm) {
      const raw = line.replace(pm[0], ' ').trim()
      // 「项目二：XXX 2024.03-2024.09」→ 剥掉序号前缀再拆公司/职位
      const ordInHead = raw.match(ENTRY_ORDINAL_RE)
      const rest = ordInHead ? clean(ordInHead[1]) : raw
      // 要点行（·/- 前缀）与长句/动词开头中的时间段不当头行，避免把一条经历误切成多条
      const headerLike = rest.length > 0 && rest.length <= 42 && !VERB_RE.test(rest) && !/^[·•-]/.test(line)
      if (headerLike) {
        if (cur) jobs.push(cur)
        proj = null
        const { company, role } = splitJobLine(rest)
        cur = newAcc({ company: company || rest || undefined, role, period: clean(pm[0]).replace(/\s+/g, '') })
        mode = 'desc'
        continue
      }
    }
    const t = clean(line)
    if (!t) continue
    // 保留行尾冒号（用于区分「核心职责：」这类字段标签与普通小标题）
    const bareSrc = line.trim().replace(/^[·•\-–—*]\s*/, '').trim()
    const bare = clean(bareSrc)

    // ① 子字段标签（技术栈 / 项目描述 / 核心职责 / 项目成果）——切换后续要点的归属
    const label = matchFieldLabel(bareSrc)
    if (label) {
      const tgt = sink()
      if (!tgt) continue
      mode = label.field
      if (label.value) appendField(tgt, label.field, label.value)
      continue
    }

    // ② 「角色：AI 应用负责人」——独立角色标签（正在填充项目时归项目，否则归经历）
    const roleM = bare.match(/^(?:担任|项目|主要|所属)?角色\s*[:：]\s*(.+)$/)
    if (roleM) {
      const v = clean(roleM[1])
      const target = proj ?? cur
      if (v && target) target.role = v.slice(0, 40)
      continue
    }

    // ③ 「项目一：XXX」
    //    · 已有任职信息（公司 / 职位 / 时间）→ 作为该经历下的一个项目挂入
    //    · 否则这条经历本身就是项目（简历没有公司层、直接逐条写项目）
    const ord = bareSrc.match(ENTRY_ORDINAL_RE)
    if (ord && !VERB_RE.test(bare)) {
      const title = clean(ord[1])
      // 项目名整体作为标题，仅当尾部是明确角色词（「XX平台 · 技术负责人」）才拆分
      const { name, role } = splitProjTail(title)
      if (cur && (cur.company || cur.role || cur.period)) {
        const p = newProj({ name: name || title, role })
        proj = p
        cur.projects = [...(cur.projects ?? []), p]
      } else {
        if (cur) jobs.push(cur)
        proj = null
        cur = newAcc({ name: name || title, role })
      }
      mode = 'desc'
      continue
    }

    // ④ 其余内容按当前模式归档（默认归入项目描述/工作内容）
    const tgt = sink()
    if (!tgt) continue
    appendField(tgt, mode, bare)
  }
  if (cur) jobs.push(cur)

  // 回捞：公司/职位缺失时，从要点中找匹配行（很多简历公司单独一行、要点另起）
  for (const j of jobs) {
    // 清理要点行：去掉标签前缀（「公司：腾讯」）、小标题行与重复的「公司 · 职位」头行
    j.desc = j.desc
      .map((d) => {
        const stripped = clean(d.replace(/^[·•-]\s*/, '').replace(/^(公司名称|公司|单位|企业|机构|职位名称|职位|岗位|职务)[:：]/, ''))
        // 要点行若与已识别的公司/职位完全一致（简历常见重复），直接丢弃
        return stripped && !SUBHEAD_RE.test(stripped) && stripped !== j.company && stripped !== j.role ? stripped : ''
      })
      .filter(Boolean)
      .map((d) => (d.startsWith('·') || d.startsWith('-') || d.startsWith('•') ? d : `· ${d}`))

    if (!j.company) {
      const idx = j.desc.findIndex((d) => {
        const t = d.replace(/^[·•-]\s*/, '')
        return !VERB_RE.test(t) && t.length >= 2 && t.length <= 26 && COMPANY_RE.test(t)
      })
      if (idx !== -1) {
        j.company = j.desc[idx].replace(/^[·•-]\s*/, '')
        j.desc.splice(idx, 1)
      }
    }
    // 公司独行 + 职位独行式简历（无机构关键词），按「首行公司、次行职位」识别（须在职位回捞前配对）
    if (!j.company && !j.role && j.desc.length >= 2) {
      const t0 = j.desc[0].replace(/^[·•-]\s*/, '')
      const t1 = j.desc[1].replace(/^[·•-]\s*/, '')
      if (!VERB_RE.test(t0) && t0.length >= 2 && t0.length <= 20 && ROLE_RE.test(t1) && t1.length <= 16 && !COMPANY_RE.test(t1)) {
        j.company = t0
        j.role = t1
        j.desc.splice(0, 2)
      }
    }
    // 公司独行（职位已识别或后续行找不到职位时）：取首条非动词短行作为公司
    if (!j.company && j.desc.length >= 1) {
      const t0 = j.desc[0].replace(/^[·•-]\s*/, '')
      if (!VERB_RE.test(t0) && !ROLE_RE.test(t0) && t0.length >= 2 && t0.length <= 20 && !/[。！？，]/.test(t0)) {
        j.company = t0
        j.desc.splice(0, 1)
      }
    }
    if (!j.role) {
      const idx = j.desc.findIndex((d) => {
        const t = d.replace(/^[·•-]\s*/, '')
        return !VERB_RE.test(t) && t !== j.company && t.length <= 16 && ROLE_RE.test(t) && !COMPANY_RE.test(t)
      })
      if (idx !== -1) {
        j.role = j.desc[idx].replace(/^[·•-]\s*/, '')
        j.desc.splice(idx, 1)
      }
    }
  }

  return jobs
    .slice(0, 8)
    .map((j) => {
      const detail = foldEntryFields(j)
      const desc = autoStyleDesc(j.desc.join('\n'))
      const name = (j.name ?? '').trim()
      const projects = (j.projects ?? [])
        .filter((p) => p.name || p.desc.length > 0 || p.duties.length > 0 || p.result.length > 0)
        .map((p) => ({
          name: clean(stripOrdinal(p.name ?? '')) || '待补充项目',
          role: clean(p.role ?? ''),
          period: p.period,
          desc: autoStyleDesc(p.desc.join('\n')),
          ...foldEntryFields(p),
        }))
      // 有「项目名称」或「项目列表」时，公司与职位允许为空（头行自动收敛）
      const selfTitled = !!name || projects.length > 0
      return {
        name: name || undefined,
        company: (j.company ?? '').trim() || (selfTitled ? '' : '待补充公司'),
        role: j.role || (selfTitled ? '' : '待补充职位'),
        period: j.period,
        desc:
          desc || (detail.tech || detail.duties || detail.result || projects.length > 0 ? '' : '· 待补充工作内容'),
        ...detail,
        projects: projects.length > 0 ? projects : undefined,
      }
    })
}

/** 项目角色常见写法（仅这些词才会被从「项目名 角色」里切出来，避免误切项目名） */
const PROJECT_ROLE_TAIL_RE =
  /^(项目负责人|技术负责人|主要负责人|负责人|项目主导|主导人|核心开发|主要开发|前端开发|后端开发|全栈开发|算法开发|测试负责人|产品负责人|主要参与者|参与者|项目成员)[:：]?$/

/** 「XX中台 · 技术负责人」→ 名称 + 角色；不含已知角色词时整串作为名称 */
function splitProjTail(s: string): { name: string; role?: string } {
  for (const sep of ['·', '・', '｜', '|', '/', '／', ' ', '\u3000']) {
    const i = s.lastIndexOf(sep)
    if (i <= 0 || i >= s.length - 1) continue
    const tail = s.slice(i + 1).trim()
    if (tail.length >= 2 && tail.length <= 10 && PROJECT_ROLE_TAIL_RE.test(tail)) {
      return { name: s.slice(0, i).trim(), role: tail }
    }
  }
  return { name: s }
}

/**
 * 项目经历：支持三种常见写法
 * A. 标签式：「项目名称：XX中台」「担任角色：负责人」「项目时间：2021.01-2021.06」「项目描述：…」
 * B. 行式：「XX中台 2021.01 - 2021.06」+ 要点行；或「项目名」独行 + 时间独行
 * C. 项目制：「项目一：XX平台」+「技术栈：…」+「核心职责：…」+「项目成果：…」
 */
function parseProjects(lines: string[]): NonNullable<ResumeData['projects']> {
  type Acc = EntryAcc & { role?: string }
  const out: Acc[] = []
  let cur: Acc | null = null
  let mode: EntryField = 'desc'

  // 注意：cur 的赋值必须发生在调用处（而非闭包里），否则 TS 会把 cur 收窄成 never
  const flush = () => {
    if (cur && (cur.name || cur.period || cur.desc.length > 0 || cur.duties.length > 0 || cur.result.length > 0)) out.push(cur)
    cur = null
  }
  const start = (init: Partial<Acc> = {}): Acc => {
    flush()
    mode = 'desc'
    cur = { period: '', desc: [], tech: '', duties: [], result: [], ...init }
    return cur
  }

  for (const raw of lines) {
    const t = clean(raw)
    if (!t) continue
    const bullet = /^[·•\-–—*]\s*/.test(t)
    // 保留行尾冒号，供字段标签识别
    const bareSrc = raw.trim().replace(/^[·•\-–—*]\s*/, '').trim()
    const bare = clean(bareSrc)

    // ① 子字段标签（技术栈 / 核心职责 / 项目成果 / 项目描述）——切换后续要点的归属
    const field = matchFieldLabel(bareSrc, ['name', 'company'])
    if (field) {
      if (!cur) {
        if (!field.value) continue
        start()
      }
      mode = field.field
      appendField(cur as Acc, field.field, field.value)
      continue
    }

    // ② 标签式字段
    const kv = bare.match(
      /^(项目名称|项目名|项目主题|项目简介|项目|担任角色|项目角色|角色|项目时间|项目周期|起止时间|项目描述|项目职责|项目内容|项目成果)[:：]\s*(.*)$/,
    )
    if (kv) {
      const label = kv[1]
      const value = clean(kv[2])
      if (/^(项目名称|项目名|项目主题|项目简介|项目)$/.test(label)) {
        start({ name: value || undefined })
        continue
      }
      if (/角色/.test(label)) {
        if (!cur) cur = start()
        if (value) cur.role = value
        continue
      }
      if (/时间|周期/.test(label)) {
        if (!cur) cur = start()
        const pm = value.match(PERIOD_RE)
        cur.period = clean(pm ? pm[0] : value).replace(/\s+/g, '').slice(0, 24)
        continue
      }
      if (!cur) cur = start()
      appendField(cur, mode, value) // 项目描述 / 职责 / 内容 / 成果
      continue
    }

    // ② 含时间段的行：名称与时间同行 → 新条目；否则补当前条目的时间
    const pm = t.match(PERIOD_RE)
    if (pm) {
      const rawRest = clean(t.replace(PERIOD_RE, ' '))
      const ordInHead = rawRest.match(ENTRY_ORDINAL_RE)
      const rest = ordInHead ? clean(ordInHead[1]) : rawRest
      const period = clean(pm[0]).replace(/\s+/g, '')
      if (rest) {
        const { name, role } = splitProjTail(rest)
        start({ name, role, period })
      } else if (cur) {
        cur.period = period
      } else {
        start({ period })
      }
      continue
    }

    // ③ 要点行
    if (bullet) {
      if (!cur) cur = start()
      appendField(cur, mode, bare)
      continue
    }

    // ④ 「项目一：XXX」→ 新条目
    const ord = bare.match(ENTRY_ORDINAL_RE)
    if (ord) {
      const title = clean(ord[1])
      if (title) {
        const { name, role } = splitProjTail(title)
        start({ name, role })
        continue
      }
    }

    // ⑤ 无项目名时这一行就是项目名；已有项目名时按角色/描述归类
    if (!cur) {
      cur = start({ name: bare })
      continue
    }
    if (!cur.name) {
      const { name, role } = splitProjTail(bare)
      cur.name = name
      if (role) cur.role = role
      continue
    }
    if (!cur.role && bare.length <= 16 && !VERB_RE.test(bare) && !/[。！？；]/.test(bare) && ROLE_RE.test(bare)) {
      cur.role = bare
      continue
    }
    appendField(cur, mode, bare)
  }
  flush()

  return out
    .filter((p) => (p.name ?? '') !== '' || p.desc.length > 0 || p.duties.length > 0 || p.result.length > 0)
    .slice(0, 6)
    .map((p) => ({
      name: clean(stripOrdinal(p.name ?? '')) || '待补充项目',
      role: clean(p.role ?? ''),
      period: p.period,
      desc: autoStyleDesc(p.desc.join('\n')),
      ...foldEntryFields(p),
    }))
}

/** 教育背景：学校 + 专业/学历（eduMajor，纸张上居中展示）+ 时间 */
function parseEdu(lines: string[]): { school?: string; eduMajor?: string; eduPeriod?: string } {
  const schoolLineIdx = lines.findIndex((l) => /大学|学院|学校|中学|University/i.test(l))
  if (schoolLineIdx === -1) return {}
  const schoolLine = lines[schoolLineIdx]
  const inlinePeriod = schoolLine.match(PERIOD_RE)
  let schoolRaw = clean(schoolLine.replace(PERIOD_RE, ' '))
  const degreeMatch = schoolRaw.match(/博士|硕士|研究生|本科|大专|专科|MBA|MPA/)
  const degree = degreeMatch ? degreeMatch[0] : ''
  if (degree) {
    // 去掉「（本科）」「(本科)」或裸学位词，再统一以全角括号附在专业尾部
    schoolRaw = clean(
      schoolRaw
        .replace(new RegExp(`[（(]\\s*${degree}\\s*[）)]`, 'g'), ' ')
        .replace(new RegExp(degree, 'g'), ' '),
    )
  }
  /** 「同济大学 · 软件工程」→ 学校 + 专业两段；无分隔符时专业为空（学位词单独成段） */
  const sepIdx = schoolRaw.search(/[·・｜|]/)
  const school = (sepIdx >= 0 ? schoolRaw.slice(0, sepIdx) : schoolRaw).trim()
  const majorRaw = sepIdx >= 0 ? schoolRaw.slice(sepIdx + 1).trim() : ''
  const eduMajor = [majorRaw, degree ? `（${degree}）` : ''].filter(Boolean).join('').trim() || undefined

  const nearby = [lines[schoolLineIdx], lines[schoolLineIdx + 1], lines[schoolLineIdx - 1]]
  const periodLine = nearby.find((l) => l && PERIOD_RE.test(l))
  const periodSource = inlinePeriod ?? (periodLine ? periodLine.match(PERIOD_RE) : null)
  const eduPeriod = periodSource ? clean(periodSource[0]).replace(/\s+/g, '') : undefined
  return { school: school || undefined, eduMajor, eduPeriod }
}

/** 技能：原文直读——按行保留简历原文，仅去掉要点符号与行尾多余分隔符，不拆词、不删「精通/熟悉」等表述。
    双栏表格行（PDF 抽取以 ｜ 分栏）拆成多条；单元格内换行被切断的孤行（纯中文短行）并回上一栏。 */
function parseSkills(lines: string[]): string[] {
  const out: string[] = []
  /** 上一行首个分栏在 out 中的下标（用于续行并回） */
  let prevFirstIdx = -1
  let prevHadCols = false
  for (const raw of lines) {
    const segs = raw.split(/[|｜]/) // 抽取插入的全角 ｜ 经 NFKC 会变半角 |，两者都按分栏切
    const curHadCols = segs.length > 1
    let rowFirstIdx = -1
    for (const seg of segs) {
      const t = clean(seg.replace(/^[·•\-–—*]\s*/, '').replace(/[、，,;；|｜]+$/, ''))
      if (!t || SUBHEAD_RE.test(t)) continue
      // 续行合并：上一行是多栏行被截断，当前是短纯中文孤行（无符号前缀）→ 并回上一栏
      const isContinuation =
        prevHadCols &&
        !curHadCols &&
        rowFirstIdx === -1 &&
        out.length > 0 &&
        t.length <= 12 &&
        /^[\u4e00-\u9fa5]/.test(t) &&
        !/^[·•\-–—*\d]/.test(raw.trim()) &&
        /[\u4e00-\u9fa5，；、]$/.test(out[prevFirstIdx] ?? '')
      if (isContinuation) {
        out[prevFirstIdx] = out[prevFirstIdx] + t
        rowFirstIdx = prevFirstIdx
        continue
      }
      if (rowFirstIdx === -1) rowFirstIdx = out.length
      out.push(t.slice(0, 80))
      if (out.length >= 8) break
    }
    if (out.length >= 8) break
    if (rowFirstIdx !== -1) prevFirstIdx = rowFirstIdx
    prevHadCols = curHadCols // 行末才更新，供下一行判断续行
  }
  return out
}

/** 常见硬技能词典：导入简历无技能区块时，从全文兜底提取 */
const SKILL_DICT = [
  // 前端 / 客户端
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'Nuxt', '小程序', 'uni-app', 'Flutter', 'Swift', 'Kotlin', 'Android', 'iOS',
  'HTML5', 'CSS3', 'Sass', 'Less', 'Tailwind', 'Webpack', 'Vite', 'Git', 'GraphQL', 'gRPC',
  // 后端 / 系统
  'Python', 'Java', 'Golang', 'Go 语言', 'Rust', 'PHP', 'C++', 'C#', '.NET', 'Spring Boot', 'Spring', 'Django', 'Flask', 'Ruby', 'Scala',
  'Kubernetes', 'K8s', 'Docker', 'Linux', 'Shell', 'Nginx', '微服务', '分布式', '高并发',
  // 数据 / 数据库
  'SQL', 'MySQL', 'Redis', 'MongoDB', 'PostgreSQL', 'Oracle', 'Kafka', 'Elasticsearch', 'Hive', 'Spark', 'Hadoop', 'Flink',
  '数据分析', '数据挖掘', '数据仓库', 'Tableau', 'Power BI', 'Excel',
  // AI / 算法
  'TensorFlow', 'PyTorch', '机器学习', '深度学习', 'NLP', '计算机视觉', '大模型', 'AIGC', 'Prompt',
  // 设计
  'Figma', 'Sketch', 'Photoshop', 'Illustrator', 'XD', 'Axure', '蓝湖', 'Principle', 'After Effects', 'Premiere', 'C4D', 'Blender',
  '交互设计', '视觉设计', 'UI 设计', 'UX 设计', '用户研究', '平面设计', '品牌设计', '三维建模',
  // 产品 / 运营 / 市场
  '产品设计', '需求分析', '竞品分析', '原型设计', 'Axure 原型', '项目管理', '敏捷开发', 'Scrum', 'OKR', 'PMP',
  'SEO', 'SEM', '信息流', '新媒体运营', '内容运营', '用户运营', '活动运营', '社群运营', '直播运营', '短视频运营', '跨境电商', '亚马逊',
  '文案策划', '品牌策划', '市场推广', '渠道拓展', '商务拓展', '客户管理', '商务谈判', '私域流量',
  // 职能
  '供应链管理', '仓储管理', '物流管理', '成本控制', '预算管理', '财务分析', '全盘账务', '纳税申报', '审计', '税务',
  '人力资源', '绩效考核', '薪酬体系', '招聘', '员工培训', '劳动关系', '行政管理', '公文写作',
  'PPT', 'PowerPoint',
  // 语言
  '英语', '日语', '韩语', '法语', '德语', '粤语',
]

/** 从全文按词典兜底提取技能（命中顺序 = 词典顺序，去重） */
function extractSkillsFromText(text: string): string[] {
  const out: string[] = []
  for (const skill of SKILL_DICT) {
    if (out.length >= 10) break
    if (/[\u4e00-\u9fa5]/.test(skill)) {
      // 中文词：子串匹配
      if (text.includes(skill)) out.push(skill)
    } else {
      // 拉丁词：词边界匹配（避免「AI」命中「AB」「C」命中「CSS」之类）
      const re = new RegExp(`(^|[^A-Za-z0-9.+#])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9.+#])`, 'i')
      if (re.test(text)) out.push(skill)
    }
  }
  return out
}

/** 量化数据模式：34%、3 倍、200 人、1.5 万、40+、峰值 3k、3.2s 等（不含「年/月」，避免误吞日期） */
const METRIC_RE =
  /\d+(?:\.\d+)?\s*(?:%|％|个百分点|倍|人|万\+?|亿|天|小时|分钟|次|条|款|单|家|城|个|\+\+?|k\b|K\b|w\b|W\b|qps|QPS|ms\b|s\b)|\d{2,}\+/

/** 已带富文本标记或列表序号的行跳过自动样式，避免嵌套混乱 */
const HAS_MARKUP_RE = /\*\*|==/

/**
 * 自动排版：导入的简历原文多为平铺文字，这里按规则注入富文本标记——
 * 1. 每行强制为要点（无列表前缀时补「- 」）
 * 2. 行内量化数据自动加粗 **34%** / **3 倍**
 * 3. 每条经历第一条要点中的首个量化数据用 ==突出==（最有说服力的亮点前置高亮）
 * 已含 ** / == 标记的行保持原样，绝不二次包裹。
 */
function autoStyleDesc(desc: string, allowHighlight = true): string {
  let hlUsed = false
  return desc
    .split('\n')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      let t = line.replace(/^[·•]\s*/, '') // 统一为 - 前缀（纸张渲染圆点）
      if (/^\d{1,2}[.、)]\s*/.test(t)) return t // 有序列表行保持原样
      if (!HAS_MARKUP_RE.test(t)) {
        t = t.replace(METRIC_RE, (m) => {
          if (allowHighlight && !hlUsed) {
            hlUsed = true
            return `==${m}==`
          }
          return `**${m}**`
        })
      }
      return `- ${t}`
    })
    .join('\n')
}

export interface ImportResult {
  data: Partial<ResumeData>
  found: string[]
  /** 抽取到的原始文本长度（0 = 扫描件/空文档） */
  textLength: number
}

/** 主入口：从简历文本解析出结构化字段 */
export function parseResumeText(input: string): ImportResult {
  const text = radicalFold(input)
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\u3000/g, ' ').trim())
  const { header, headerLines, sections } = splitSections(lines)
  const { phone, email } = extractContact(lines, header)
  const name = extractName(header, headerLines)

  const getSection = (key: string) => sections.find((s) => s.key === key)

  const workSec = getSection('work')
  // 兜底：文档里没有任何区块标题时，全文按工作经历逻辑试探
  const jobs = workSec ? parseJobs(workSec.lines) : sections.length === 0 ? parseJobs(lines) : []
  const eduSec = getSection('edu')
  const edu = eduSec ? parseEdu(eduSec.lines) : {}
  const skillSec = getSection('skills')
  // 技能特长：优先读技能区块；区块缺失或解析为空时，按词典从全文兜底提取
  const skills = (() => {
    if (skillSec) {
      const parsed = parseSkills(skillSec.lines)
      if (parsed.length > 0) return parsed
    }
    return extractSkillsFromText(text)
  })()
  const projSec = getSection('project')
  const projects = projSec ? parseProjects(projSec.lines) : []
  const summarySec = getSection('summary')
  const summary = summarySec ? summarySec.lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 160) : undefined

  // 工作年限：标签值兜底 → 全文扫描「N 年（工作）经验」
  let years = header.years ? header.years.replace(/\s+/g, '') : undefined
  if (!years) {
    const m = text.replace(/\s+/g, '').match(/(\d{1,2})年(?:的)?(?:相关)?(?:工作)?经验/)
    if (m) years = `${m[1]}年经验`
  }
  if (years) {
    if (/^\d+$/.test(years)) years = `${years}年经验`
    else if (/^\d+年$/.test(years)) years = `${years}经验`
    years = years.slice(0, 16)
  }

  // 所在城市：标签值兜底 → 头部信息行扫描常见城市名
  let city = header.city ? clean(header.city) : undefined
  if (!city) {
    const CITY_RE =
      /(?:^|[|｜·,，、\s])(北京|上海|天津|重庆|广州|深圳|杭州|成都|南京|武汉|西安|苏州|长沙|郑州|青岛|合肥|厦门|无锡|福州|济南|大连|宁波|昆明|沈阳|哈尔滨|石家庄|南昌|贵阳|太原|珠海|佛山|东莞|常州|嘉兴|绍兴|南通|烟台|徐州|扬州|惠州|中山|泉州|温州)(?:市)?(?:$|[|｜·,，、\s])/
    for (const line of headerLines.slice(0, 8)) {
      const m = line.match(CITY_RE)
      if (m) {
        city = m[1]
        break
      }
    }
  }
  if (city) city = city.replace(/市$/, '')

  const data: Partial<ResumeData> = {
    name,
    intent: header.intent,
    years,
    city,
    phone,
    email,
    jobs: jobs.length > 0 ? jobs : undefined,
    projects: projects.length > 0 ? projects : undefined,
    school: edu.school,
    eduMajor: edu.eduMajor,
    eduPeriod: edu.eduPeriod,
    skills: skills.length > 0 ? skills : undefined,
    summary,
  }

  const found: string[] = []
  if (name) found.push('姓名')
  if (header.intent) found.push('求职意向')
  if (years) found.push('工作年限')
  if (city) found.push('所在城市')
  if (phone) found.push('电话')
  if (email) found.push('邮箱')
  if (jobs.length > 0) found.push(`${jobs.length} 段工作经历`)
  if (projects.length > 0) found.push(`${projects.length} 个项目经历`)
  if (edu.school) found.push('教育背景')
  if (skills.length > 0) found.push(`${skills.length} 项技能`)
  if (summary) found.push('自我评价')

  return { data, found, textLength: text.trim().length }
}
