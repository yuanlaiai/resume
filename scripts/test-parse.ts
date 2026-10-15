import { parseResumeText } from '../src/lib/parseResume.ts'

/* ---------- 用例 1：基础 5 段经历 + 伪空格姓名 ---------- */
const text1 = `陈 墨 白
求职意向：产品总监
电话：138-0011-2233
邮箱：chensimo@corp.com

工作经历
2021.07-至今 字节跳动 产品总监
· 主导商业化产品线从 0 到 1
2019.03-2021.06 阿里巴巴 高级产品经理
· 负责淘宝搜索推荐
2017.06-2019.02 美团点评 产品经理
· 负责外卖增长
2015.07-2017.05 腾讯 初级产品经理
· 负责 QQ 空间
2013.07-2015.06 明求数据科技有限公司高级产品经理
· 负责数据产品线
教育背景
2013.09-2017.06 复旦大学 新闻传播学（本科）
技能特长
产品设计、数据分析、用户调研
自我评价
5 年互联网产品经验，完整经历多条业务线。`

const r1 = parseResumeText(text1)
console.log('== 用例1 ==')
console.log('found:', r1.found)
console.log('name:', r1.data.name)
console.log('jobs:', r1.data.jobs?.length)
for (const j of r1.data.jobs ?? []) console.log(' -', j.period, '|', j.company, '|', j.role)

const pass1 =
  r1.data.name === '陈墨白' &&
  (r1.data.jobs?.length ?? 0) === 5 &&
  r1.data.school?.includes('复旦大学') === true &&
  // 技能原文直读：整行保留，不拆分
  r1.data.skills?.join('\n').includes('产品设计、数据分析、用户调研') === true
console.log(pass1 ? '✅ 用例1 PASS' : '❌ 用例1 FAIL')

/* ---------- 用例 2：混乱样本 —— 要点里带年份区间、小标题行、纯时间行、空行 ---------- */
const text2 = `王小明
求职意向：高级运营经理
电话：139-2222-3333
邮箱：wxm@test.com

工作经历
2022.03-至今 小红书 高级运营经理
工作内容：
· 负责 2022-2023 年度大促活动整体统筹，GMV 提升 40%

· 搭建内容运营体系，日均曝光提升 2 倍
2020.01-2022.02

字节跳动
运营经理
工作职责：
· 2019-2020 年间参与抖音电商冷启动
· 负责活动策划与执行
2017.07-2019.12 美团点评 · 高级运营专员
· 负责外卖品类运营，在 2018 年双 11 期间单量提升 60%
教育背景
2013.09-2017.06 武汉大学 市场营销（本科）
技能特长
活动策划、数据分析、内容运营
自我评价
7 年互联网运营经验。`

const r2 = parseResumeText(text2)
console.log('\n== 用例2（混乱样本） ==')
console.log('found:', r2.found)
console.log('name:', r2.data.name)
console.log('jobs:', r2.data.jobs?.length)
for (const j of r2.data.jobs ?? []) console.log(' -', j.period, '|', j.company, '|', j.role, '|', JSON.stringify(j.desc))

const jobs2 = r2.data.jobs ?? []
const descLines = (j: { desc: string } | undefined) => (j?.desc ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
const pass2 =
  r2.data.name === '王小明' &&
  jobs2.length === 3 &&
  jobs2[0]?.company === '小红书' &&
  descLines(jobs2[0]).length === 2 &&
  descLines(jobs2[0]).every((d) => d !== '') &&
  !descLines(jobs2[0]).some((d) => d.includes('工作内容')) &&
  jobs2[1]?.company === '字节跳动' &&
  jobs2[1]?.role === '运营经理' &&
  jobs2[2]?.company === '美团点评' &&
  // 要点中的「2018 年双 11」不应被切成新经历
  !descLines(jobs2[2]).some((d) => d === '· 待补充工作内容') &&
  r2.data.school?.includes('武汉大学') === true
console.log(pass2 ? '✅ 用例2 PASS' : '❌ 用例2 FAIL')

/* ---------- 用例 3：装饰符号标题 + 「标题：内容」同行 + 标题混入经历 ---------- */
const text3 = `李文静
求职意向：新媒体运营
电话：136-8888-9999
邮箱：lijingjing@test.com

工作经历
2021.05-至今 字节跳动 新媒体运营
· 负责官方账号内容策划与发布
2018.07-2021.04 网易 新媒体专员
· 负责公众号日常运营
◆个人技能
短视频剪辑、文案撰写、数据复盘
★个人评价
3 年新媒体运营经验，对热点敏感。`
const r3 = parseResumeText(text3)
console.log('\n== 用例3（装饰符号标题） ==')
console.log('found:', r3.found)
console.log('jobs:', r3.data.jobs?.length, '| skills:', JSON.stringify(r3.data.skills), '| summary:', r3.data.summary)
// 「◆个人技能」「★个人评价」不应混进任何经历的描述里
const allDesc3 = (r3.data.jobs ?? []).map((j) => j.desc).join('\n')
const pass3 =
  (r3.data.jobs?.length ?? 0) === 2 &&
  r3.data.skills?.join('\n').includes('短视频剪辑、文案撰写、数据复盘') === true &&
  !!r3.data.summary &&
  !allDesc3.includes('个人技能') &&
  !allDesc3.includes('个人评价') &&
  !allDesc3.includes('短视频剪辑')
console.log(pass3 ? '✅ 用例3 PASS' : '❌ 用例3 FAIL')

/* ---------- 用例 4：「个人技能：xxx」「个人评价：xxx」标题内容同行 ---------- */
const text4 = `赵子航
求职意向：前端工程师
电话：135-7777-8888
邮箱：zhaozihang@test.com

工作经历
2020.06-至今 腾讯 前端工程师
· 负责小程序性能优化
个人技能：React、TypeScript、Node.js
个人评价：4 年前端经验，注重工程质量。`
const r4 = parseResumeText(text4)
console.log('\n== 用例4（标题内容同行） ==')
console.log('found:', r4.found)
console.log('skills:', JSON.stringify(r4.data.skills), '| summary:', r4.data.summary)
const allDesc4 = (r4.data.jobs ?? []).map((j) => j.desc).join('\n')
const pass4 =
  r4.data.skills?.join('\n').includes('React、TypeScript、Node.js') === true &&
  (r4.data.summary?.includes('前端经验') ?? false) &&
  !allDesc4.includes('个人技能') &&
  !allDesc4.includes('个人评价')
console.log(pass4 ? '✅ 用例4 PASS' : '❌ 用例4 FAIL')

/* ---------- 用例 5：带序号的区块标题（01. / 四、/ 3、）——曾经整块被吞进工作经历 ---------- */
const text5 = `孙悦
求职意向：UI 设计师
电话：134-1234-5678
邮箱:sunyue@test.com

工作经历
2020.08-至今 网易 UI 设计师
· 负责云音乐视觉改版

01.个人技能
Figma、Sketch、动效设计

四、个人评价
5 年 UI 设计经验，审美在线。`
const r5 = parseResumeText(text5)
console.log('\n== 用例5（序号区块标题） ==')
console.log('found:', r5.found)
console.log('jobs:', r5.data.jobs?.length, '| skills:', JSON.stringify(r5.data.skills), '| summary:', r5.data.summary)
const allDesc5 = (r5.data.jobs ?? []).map((j) => j.desc).join('\n')
const pass5 =
  (r5.data.jobs?.length ?? 0) === 1 &&
  r5.data.skills?.join('\n').includes('Figma、Sketch、动效设计') === true &&
  !!r5.data.summary &&
  !allDesc5.includes('个人技能') &&
  !allDesc5.includes('个人评价') &&
  !allDesc5.includes('Figma')
console.log(pass5 ? '✅ 用例5 PASS' : '❌ 用例5 FAIL')

/* ---------- 用例 6：项目经历（行式 + 标签式），且不与技能/评价串味 ---------- */
const text6 = `周雅琴
求职意向：高级前端工程师
电话：137-5555-6666
邮箱:zhouyaqin@corp.com

工作经历
2021.06-至今 拼多多 资深前端工程师
· 负责交易中台前端架构

项目经历
01. 电商中台重构 2022.03 - 2022.12
· 主导交易链路重构，QPS 提升 3 倍
· 推动微前端方案落地，构建耗时下降 40%
项目名称：智能推荐系统
担任角色：核心开发
项目时间：2021.01 - 2021.10
项目描述：负责召回与排序模块的前端开发

个人技能：React、TypeScript、Vue
个人评价：6 年前端经验，主导过多个中台项目。`
const r6 = parseResumeText(text6)
console.log('\n== 用例6（项目经历） ==')
console.log('found:', r6.found)
console.log('projects:', r6.data.projects?.length)
for (const p of r6.data.projects ?? []) console.log(' -', p.period, '|', p.name, '|', p.role, '|', JSON.stringify(p.desc))
const projs6 = r6.data.projects ?? []
const pass6 =
  projs6.length === 2 &&
  projs6[0]?.name === '电商中台重构' &&
  projs6[0]?.period === '2022.03-2022.12' &&
  projs6[0]?.desc.split('\n').filter(Boolean).length === 2 &&
  projs6[1]?.name === '智能推荐系统' &&
  projs6[1]?.role === '核心开发' &&
  projs6[1]?.period === '2021.01-2021.10' &&
  (projs6[1]?.desc.includes('召回与排序') ?? false) &&
  r6.data.skills?.join('\n').includes('React、TypeScript、Vue') === true &&
  (r6.data.summary?.includes('前端经验') ?? false) &&
  // 项目内容不应混进工作经历
  !(r6.data.jobs ?? []).some((j) => j.desc.includes('微前端'))
console.log(pass6 ? '✅ 用例6 PASS' : '❌ 用例6 FAIL')

if (!pass1 || !pass2 || !pass3 || !pass4 || !pass5 || !pass6) process.exit(1)
