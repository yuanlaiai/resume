/**
 * 经历条目的结构化子字段（项目制简历常用）。
 * 很多简历不分「工作经历 / 项目经历」，而是把每个项目直接写在经历条目里：
 * 项目名称 → 角色 → 技术栈 → 项目描述 → 核心职责 → 项目成果。
 * 三个字段均为可选，缺省时条目按原有「头行 + 描述」渲染，不影响老数据。
 */
export interface EntryDetail {
  /** 技术栈（如 Java / Spring Boot / LangChain / Vue3） */
  tech?: string
  /** 核心职责（多行富文本，每行一条职责要点） */
  duties?: string
  /** 项目成果（支持 **加粗** 与 ==突出== 标记） */
  result?: string
}

/**
 * 一条工作经历下的单个项目。
 * 常见写法：「2019.08 — 至今  XX公司  高级开发工程师」下面挂「项目一 / 项目二 / 项目三」，
 * 每个项目自带 项目名称 → 角色 → 技术栈 → 项目描述 → 核心职责 → 项目成果。
 */
export interface JobProject extends EntryDetail {
  /** 项目名称 */
  name: string
  /** 担任角色 */
  role: string
  /** 项目时间（可空，沿用任职时间） */
  period: string
  desc: string
}

export interface Job extends EntryDetail {
  /**
   * 项目名称。仅当简历里没有「公司 + 职位」这一层、直接逐条写项目时使用；
   * 有公司层时留空，项目写进 projects。
   */
  name?: string
  company: string
  role: string
  period: string
  desc: string
  /** 任职期间的项目列表（项目制简历），无则退化为单条经历 */
  projects?: JobProject[]
}

/** 项目经历条目 */
export interface Project extends EntryDetail {
  /** 项目名称 */
  name: string
  /** 担任角色 */
  role: string
  period: string
  desc: string
}

export interface ResumeData {
  name: string
  intent: string
  /** 工作年限（页眉展示，如「5 年经验」，可选） */
  years?: string
  /** 所在城市（页眉展示，如「上海」，可选） */
  city?: string
  phone: string
  email: string
  jobs: Job[]
  /** 项目经历（可选模块，未填写时不占版面） */
  projects?: Project[]
  school: string
  /** 专业 / 学历（如「软件工程（本科）」）；纸张上学校居左、学历居中、时间居右。空时从 school 的「·」分隔符拆分 */
  eduMajor?: string
  eduPeriod: string
  skills: string[]
  summary: string
  /** 证件照（本地 base64，不参与分享链接，避免 URL 超长） */
  avatar?: string
  /** 区块标题自定义名称（如「工作经历」→「实习经历」），缺省用默认名 */
  titles?: Partial<Record<SectionTitleKey, string>>
}

/** 可编辑标题的区块 key */
export type SectionTitleKey = 'jobs' | 'projects' | 'edu' | 'skills' | 'summary'

/** 区块标题默认名称 */
export const SECTION_TITLE_DEFAULTS: Record<SectionTitleKey, string> = {
  jobs: '工作经历',
  projects: '项目经历',
  edu: '教育背景',
  skills: '技能特长',
  summary: '自我评价',
}

/** 纸张版式结构 */
export type PaperLayout =
  | 'single'    // 单栏（经典上下结构）
  | 'sidebar'   // 双栏：左侧信息栏 + 右侧主栏
  | 'timeline'  // 单栏：工作经历时间轴
  | 'edu-first' // 单栏：教育背景前置（应届生）

/** 姓名艺术字样式 */
export type NameStyle = 'plain' | 'shadow' | 'stroke' | 'gradient' | 'spacing'

/** 纸张装饰插画 */
export type PaperDeco =
  | 'none'
  | 'floral'    // 花卉
  | 'geo'       // 几何色块
  | 'wave'      // 波浪
  | 'mountain'  // 山峦日出
  | 'dots'      // 波点阵
  | 'stripes'   // 斜纹肌理
  | 'starry'    // 星空
  | 'leaf'      // 枝叶
  | 'blob'      // 渐变色块
  | 'confetti'  // 彩纸屑
  | 'halftone'  // 半调网点
  | 'arch'      // 拱门色块

/** 区块标题样式 */
export type TitleStyle =
  | 'bar'        // 左侧小竖条（默认）
  | 'underline'  // 标题下方细色条（清爽线条风）
  | 'tag'        // 实色圆角标签白字（商务标签风）
  | 'line'       // 强调色标题 + 通栏细分隔线（素雅衬线风）
  | 'docer'      // 小方块标记 + 黑色加粗标题 + 细灰线贯穿（宋体公文风）

/** 模板库风格分类 */
export type TemplateCategory = '简约经典' | '商务正式' | '清新彩色' | '创意设计' | '深色质感'

/** 用户自定义样式（叠加在任意模板之上） */
export interface StyleOverride {
  /** 自定义主题色：null/undefined = 跟随模板 */
  accent?: string | null
  /** 姓名艺术字 */
  nameStyle: NameStyle
  /** 装饰插画：'auto' = 跟随模板默认 */
  decoration: 'auto' | PaperDeco
}

export interface ResumeTemplate {
  id: string
  name: string
  /** 适用职业方向（模板库展示用） */
  profession: string
  /** 模板切换胶囊上的色点 */
  dot: string
  /** 纸张内的强调色（CSS 变量注入） */
  accent: string
  /** 纸张内强调色的浅底（技能标签等） */
  accentSoft: string
  /** 纸张字体：'' 为默认无衬线，'font-serif-paper' 为衬线 */
  paperFontClass: string
  /** 纸张版式 */
  layout: PaperLayout
  /** 单栏版式：页眉色带 */
  headerBand?: boolean
  /** 页眉色带为深色（如藏蓝大气：深色带 + 白字） */
  headerDark?: boolean
  /** 单栏版式：左侧色轨 */
  rail?: boolean
  /** 双栏版式：深色侧栏 */
  sidebarDark?: boolean
  /** 模板库风格分类 */
  category?: TemplateCategory
  /** 区块标题样式（缺省为左竖条） */
  titleStyle?: TitleStyle
  /** 深色纸张（整页深底 + 浅色文字） */
  paperDark?: boolean
  /** 纸张模块小图标（区块标题 + 联系方式） */
  icons?: boolean
  /** 技能特长展示：'tags'（默认标签）| 'bars'（进度条） */
  skillsStyle?: 'tags' | 'bars'
  /** 宋体公文风 KV 栅格页眉（照片居左 + 姓名下划线 + 信息栅格，复刻稻壳简历版式） */
  kvHeader?: boolean
  /** 页眉渐变色带（与 headerBand 搭配）[起始色, 结束色] */
  headerGradient?: [string, string]
  /** 纸张默认装饰插画 */
  decoration?: PaperDeco
  /** 模板职业示例内容：未编辑状态下切换模板自动填充 */
  demo: ResumeData
}
