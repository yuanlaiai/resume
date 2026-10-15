interface IconProps {
  className?: string
}

/** 品牌 Logo：鼠尾草青渐变圆角方块 + 折角文档 + 琥珀对勾徽章（「一份合格的简历」） */
export function LogoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5BA69D" />
          <stop offset="1" stopColor="#3F7B73" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill="url(#logo-bg)" />
      {/* 折角文档 */}
      <path
        d="M10.5 6.5h7.4l4.6 4.6v13.4a1.5 1.5 0 0 1-1.5 1.5H10.5a1.5 1.5 0 0 1-1.5-1.5V8a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="white"
      />
      <path d="M17.9 6.5l4.6 4.6h-3.1a1.5 1.5 0 0 1-1.5-1.5V6.5Z" fill="#C9E2DE" />
      {/* 正文行 */}
      <rect x="11.5" y="14" width="9" height="1.7" rx="0.85" fill="#4F8A82" />
      <rect x="11.5" y="17.6" width="9" height="1.7" rx="0.85" fill="#4F8A82" />
      <rect x="11.5" y="21.2" width="5.5" height="1.7" rx="0.85" fill="#8FBDB7" />
      {/* 琥珀对勾徽章 */}
      <circle cx="23.4" cy="23.4" r="4.6" fill="#E8B84B" stroke="#FDFBF7" strokeWidth="1.6" />
      <path d="M21.3 23.5l1.5 1.5 2.9-3.1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 展开态箭头（向下） */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 折叠态箭头（向右） */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 分享链接图标 */
export function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 9.5L9.5 6.5M7 4.7L8.6 3.1C9.6 2.1 11.3 2.1 12.3 3.1C13.3 4.1 13.3 5.8 12.3 6.8L10.7 8.4M9 11.3L7.4 12.9C6.4 13.9 4.7 13.9 3.7 12.9C2.7 11.9 2.7 10.2 3.7 9.2L5.3 7.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 下载图标 */
export function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2.5V10M8 10L5 7.2M8 10L11 7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.8 12.2H13.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 同步成功图标 */
export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7.5" cy="7.5" r="7" fill="#7BA688" />
      <path d="M4.8 7.6L6.7 9.4L10.2 5.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MinusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 关闭图标 */
export function XIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 模板库网格图标 */
export function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** 样式调色板图标 */
export function PaletteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 14.2C4.5 14.2 1.8 11.5 1.8 8S4.5 1.8 8 1.8s6.2 2.4 6.2 5.4c0 1.9-1.5 3-3 3h-1.4c-.9 0-1.6.7-1.6 1.6 0 .4.2.8.4 1.1.2.3.3.6.3.9 0 .2-.3.4-.9.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="5.2" cy="8.4" r="1" fill="currentColor" />
      <circle cx="6.6" cy="5.4" r="1" fill="currentColor" />
      <circle cx="9.8" cy="4.8" r="1" fill="currentColor" />
    </svg>
  )
}

/** 文档导入图标 */
export function ImportIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.2 1.8H4.5C3.95 1.8 3.5 2.25 3.5 2.8V13.2C3.5 13.75 3.95 14.2 4.5 14.2H11.5C12.05 14.2 12.5 13.75 12.5 13.2V5.1L9.2 1.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 2V5.3H12.3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7.6V11.2M8 11.2L6.4 9.7M8 11.2L9.6 9.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 头像占位相机图标 */
export function CameraIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.5 5.5L8.6 3.8C8.79 3.5 9.11 3.33 9.46 3.33H10.54C10.89 3.33 11.21 3.5 11.4 3.8L12.5 5.5H14.17C15.18 5.5 16 6.32 16 7.33V13.67C16 14.68 15.18 15.5 14.17 15.5H5.83C4.82 15.5 4 14.68 4 13.67V7.33C4 6.32 4.82 5.5 5.83 5.5H7.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.3" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** AI 助手星芒图标 */
export function SparklesIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2.5l1.7 4.6a1 1 0 00.6.6l4.6 1.7-4.6 1.7a1 1 0 00-.6.6L10 16.3l-1.7-4.6a1 1 0 00-.6-.6L3.1 9.4l4.6-1.7a1 1 0 00.6-.6L10 2.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M16 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="currentColor" opacity="0.6" />
    </svg>
  )
}
