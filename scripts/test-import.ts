/** Node 端导入链路测试：PDF/Word 抽取 → 规则解析，检查姓名与自动排版 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import mammoth from 'mammoth'
import { parseResumeText, radicalFold } from '../src/lib/parseResume.ts'

async function pdfToText(path: string): Promise<string> {
  const data = new Uint8Array((await import('node:fs')).readFileSync(path))
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
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
      if (last && Math.abs(last.y - f.y) <= 4) last.parts.push(f)
      else clusters.push({ y: f.y, parts: [f] })
    }
    const lines = clusters
      .map((c) => {
        const sorted = c.parts.sort((a, b) => a.x - b.x)
        let out = ''
        let prevEnd = -Infinity
        for (const p of sorted) {
          if (!out) out = p.str
          else {
            const gap = p.x - prevEnd
            const threshold = Math.max(4, p.h * 0.5)
            out += gap > threshold ? '｜' : ' '
            out += p.str
          }
          prevEnd = p.x + p.w
        }
        return out.replace(/\s+/g, ' ').trim()
      })
      .filter(Boolean)
    pages.push(lines.join('\n'))
  }
  return radicalFold(pages.join('\n').normalize('NFKC'))
}

function show(label: string, file: string, text: string) {
  const r = parseResumeText(text)
  console.log(`\n===== ${label} (${file}) =====`)
  console.log('found:', r.found.join(' / '))
  console.log('name:', r.data.name, '| city:', r.data.city, '| years:', r.data.years)
  console.log('jobs:', (r.data.jobs ?? []).length, 'skills:', (r.data.skills ?? []).length)
  console.log('skills:', JSON.stringify(r.data.skills))
  const j0 = r.data.jobs?.[0]
  if (j0) console.log('job[0].desc:\n' + j0.desc.split('\n').map((l) => '    ' + l).join('\n'))
  if (r.data.summary) console.log('summary:', r.data.summary.slice(0, 40))
}

// PDF A（姓名独立行 + 右侧联系块 + 双栏技能表格）
const pdfA = await pdfToText('/tmp/test-resume-a.pdf')
console.log('--- PDF A 原文前 6 行 ---')
console.log(pdfA.split('\n').slice(0, 6).join('\n'))
show('PDF A', 'tpl-a', pdfA)

// PDF B（姓名+电话+邮箱+城市挤在同一行）
const pdfB = await pdfToText('/tmp/test-resume-b.pdf')
console.log('\n--- PDF B 原文前 4 行 ---')
console.log(pdfB.split('\n').slice(0, 4).join('\n'))
show('PDF B', 'tpl-b', pdfB)

// Word（姓名与联系方式同行）
const docx = await mammoth.extractRawText({ path: '/tmp/test-resume.docx' })
show('Word', 'docx', docx.value.normalize('NFKC'))
