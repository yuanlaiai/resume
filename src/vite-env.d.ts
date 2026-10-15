/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DeepSeek API Key（构建时注入，优先级低于浏览器内手动填写的 Key） */
  readonly VITE_DEEPSEEK_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
