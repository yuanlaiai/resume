import type { PaperDeco } from '../types'

/** 装饰层统一容器：浮于纸面之上、内容之下 */
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: -1 }} aria-hidden="true">
      {children}
    </div>
  )
}

/** 花朵插画：6 片椭圆花瓣环绕花心 */
function Flower({ size, className, opacity }: { size: number; className?: string; opacity: number }) {
  const c = size / 2
  const r = size * 0.42
  const petalRy = size * 0.19
  const petalRx = size * 0.115
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ opacity }}>
      <g fill="var(--paper-accent)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx={c} cy={c - r * 0.62} rx={petalRx} ry={petalRy} transform={`rotate(${a} ${c} ${c})`} />
        ))}
      </g>
      <circle cx={c} cy={c} r={size * 0.1} fill="#ffffff" opacity={0.9} />
    </svg>
  )
}

/** 桉叶枝：主茎 + 交错圆叶 */
function LeafBranch({ className, size, opacity, flip = false }: { className?: string; size: number; opacity: number; flip?: boolean }) {
  const h = size * 0.62
  return (
    <svg
      className={className}
      width={size}
      height={h}
      viewBox="0 0 200 124"
      fill="none"
      style={{ opacity, transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <path d="M4 120C50 96 110 60 196 8" stroke="var(--paper-accent)" strokeWidth="2.6" strokeLinecap="round" />
      {[
        [46, 88, -38], [72, 74, 30], [92, 60, -42], [116, 47, 28], [136, 34, -40], [158, 22, 26], [176, 13, -36],
      ].map(([x, y, rot], i) => (
        <ellipse key={i} cx={x} cy={y} rx="14" ry="7" fill="var(--paper-accent)" transform={`rotate(${rot} ${x} ${y})`} />
      ))}
    </svg>
  )
}

/** 星星四角 */
function Sparkle({ className, size, opacity }: { className?: string; size: number; opacity: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity }}>
      <path d="M12 1C12.8 6.4 15.6 9.2 21 10C15.6 10.8 12.8 13.6 12 19C11.2 13.6 8.4 10.8 3 10C8.4 9.2 11.2 6.4 12 1Z" fill="var(--paper-accent)" />
    </svg>
  )
}

/** 纸张装饰插画层（zIndex -1：浮于纸面之上、内容之下） */
export default function PaperDeco({ deco }: { deco: PaperDeco }) {
  if (deco === 'floral') {
    return (
      <Layer>
        {/* 右上主花 + 小花 */}
        <Flower size={150} className="absolute -right-8 -top-8" opacity={0.16} />
        <Flower size={92} className="absolute right-[104px] top-[52px]" opacity={0.1} />
        <Flower size={64} className="absolute right-[52px] top-[128px]" opacity={0.08} />
        {/* 左下花丛 */}
        <Flower size={120} className="absolute -left-6 bottom-[92px]" opacity={0.12} />
        <Flower size={78} className="absolute left-[64px] bottom-[52px]" opacity={0.1} />
        <Flower size={56} className="absolute -left-4 -bottom-4" opacity={0.09} />
        {/* 茎叶弧线 */}
        <svg className="absolute bottom-0 left-0" width="230" height="150" viewBox="0 0 230 150" fill="none" style={{ opacity: 0.14 }}>
          <path d="M10 150C40 100 90 70 170 60" stroke="var(--paper-accent)" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 150C85 115 120 95 200 88" stroke="var(--paper-accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </Layer>
    )
  }

  if (deco === 'geo') {
    return (
      <Layer>
        <span className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[var(--paper-accent)] opacity-10" />
        <span className="absolute right-[130px] top-[46px] h-16 w-16 rounded-full border-[10px] border-[var(--paper-accent)] opacity-15" />
        <span className="absolute right-[86px] top-[132px] h-3.5 w-3.5 rounded-full bg-[var(--paper-accent)] opacity-20" />
        <span className="absolute -left-5 bottom-[70px] h-20 w-20 rounded-full bg-[var(--paper-accent)] opacity-[0.08]" />
        <span className="absolute left-[76px] bottom-[46px] h-4 w-4 rounded-[3px] bg-[var(--paper-accent)] opacity-20" />
        <span className="absolute left-[46px] bottom-[104px] h-2.5 w-2.5 rounded-[2px] bg-[var(--paper-accent)] opacity-15" />
      </Layer>
    )
  }

  if (deco === 'wave') {
    return (
      <Layer>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 560 90" preserveAspectRatio="none" height="90" fill="none">
          <path d="M0 46C80 12 160 82 280 58C400 34 480 70 560 40V90H0V46Z" fill="var(--paper-accent)" opacity={0.1} />
          <path d="M0 66C90 38 190 92 310 70C420 50 500 80 560 60V90H0V66Z" fill="var(--paper-accent)" opacity={0.08} />
        </svg>
        <span className="absolute right-[60px] top-[44px] h-2 w-2 rounded-full bg-[var(--paper-accent)] opacity-25" />
        <span className="absolute right-[88px] top-[62px] h-1.5 w-1.5 rounded-full bg-[var(--paper-accent)] opacity-20" />
      </Layer>
    )
  }

  if (deco === 'mountain') {
    return (
      <Layer>
        {/* 太阳 */}
        <span className="absolute right-[64px] top-[54px] h-14 w-14 rounded-full bg-[var(--paper-accent)] opacity-15" />
        <span className="absolute right-[74px] top-[64px] h-9 w-9 rounded-full bg-[var(--paper-accent)] opacity-20" />
        {/* 层叠山峦 */}
        <svg className="absolute bottom-0 left-0 w-full" height="150" viewBox="0 0 560 150" preserveAspectRatio="none" fill="none">
          <path d="M0 96L96 44L190 96L280 52L384 110L468 62L560 104V150H0V96Z" fill="var(--paper-accent)" opacity={0.1} />
          <path d="M0 122L120 76L232 122L344 84L452 126L560 92V150H0V122Z" fill="var(--paper-accent)" opacity={0.12} />
          <path d="M0 138L160 108L300 140L430 112L560 134V150H0V138Z" fill="var(--paper-accent)" opacity={0.14} />
        </svg>
        {/* 飞鸟 */}
        <svg className="absolute right-[150px] top-[110px]" width="46" height="16" viewBox="0 0 46 16" fill="none" style={{ opacity: 0.28 }}>
          <path d="M2 10C6 5 10 5 13 9M13 9C16 4 21 4 24 8" stroke="var(--paper-accent)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M30 12C33 8 36 8 38 11M38 11C41 7 44 7 45 10" stroke="var(--paper-accent)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </Layer>
    )
  }

  if (deco === 'dots') {
    const dot = 4
    const gap = 26
    const rows = 6
    const cols = 8
    return (
      <Layer>
        {/* 右上点阵 */}
        <svg className="absolute right-0 top-0" width={cols * gap} height={rows * gap} style={{ opacity: 0.16 }}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={c * gap + gap / 2} cy={r * gap + gap / 2} r={dot / 2} fill="var(--paper-accent)" />
            )),
          )}
        </svg>
        {/* 左下点阵（反向渐隐） */}
        <svg className="absolute bottom-0 left-0" width={cols * gap} height={rows * gap} style={{ opacity: 0.12 }}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={c * gap + gap / 2} cy={r * gap + gap / 2} r={dot / 2} fill="var(--paper-accent)" opacity={1 - r / rows} />
            )),
          )}
        </svg>
        <span className="absolute right-[218px] top-[36px] h-3 w-3 rounded-full border-2 border-[var(--paper-accent)] opacity-25" />
        <span className="absolute left-[210px] bottom-[160px] h-2.5 w-2.5 rounded-full bg-[var(--paper-accent)] opacity-20" />
      </Layer>
    )
  }

  if (deco === 'stripes') {
    return (
      <Layer>
        {/* 右上斜纹 */}
        <svg className="absolute right-0 top-0" width="200" height="200" style={{ opacity: 0.12 }}>
          <defs>
            <clipPath id="stripe-clip-tr"><path d="M0 0H200V200L0 0Z" /></clipPath>
          </defs>
          <g clipPath="url(#stripe-clip-tr)" stroke="var(--paper-accent)" strokeWidth="7">
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={i} x1={-200 + i * 30} y1={200} x2={i * 30} y2={0} />
            ))}
          </g>
        </svg>
        {/* 左下斜纹 */}
        <svg className="absolute bottom-0 left-0" width="170" height="170" style={{ opacity: 0.1 }}>
          <defs>
            <clipPath id="stripe-clip-bl"><path d="M0 170L170 0L170 170L0 170Z" /></clipPath>
          </defs>
          <g clipPath="url(#stripe-clip-bl)" stroke="var(--paper-accent)" strokeWidth="7">
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={i} x1={-170 + i * 30} y1={170} x2={i * 30} y2={0} />
            ))}
          </g>
        </svg>
        <span className="absolute right-[210px] top-[26px] h-4 w-4 rounded-full bg-[var(--paper-accent)] opacity-15" />
      </Layer>
    )
  }

  if (deco === 'starry') {
    return (
      <Layer>
        {/* 月亮 */}
        <span className="absolute right-[54px] top-[48px] h-16 w-16 rounded-full bg-[var(--paper-accent)] opacity-15" />
        <span className="absolute right-[80px] top-[42px] h-14 w-14 rounded-full bg-white" />
        {/* 星星散布 */}
        <Sparkle className="absolute right-[140px] top-[36px]" size={22} opacity={0.3} />
        <Sparkle className="absolute right-[104px] top-[110px]" size={14} opacity={0.24} />
        <Sparkle className="absolute right-[186px] top-[76px]" size={12} opacity={0.2} />
        <Sparkle className="absolute right-[64px] top-[168px]" size={16} opacity={0.22} />
        <Sparkle className="absolute left-[46px] bottom-[210px]" size={18} opacity={0.2} />
        <Sparkle className="absolute left-[120px] bottom-[176px]" size={11} opacity={0.18} />
        {/* 底部星尘点 */}
        {[[320, 700, 3], [400, 730, 2.5], [470, 708, 2], [520, 742, 3], [90, 740, 2.5], [180, 762, 2], [260, 744, 2.5]].map(([x, y, r], i) => (
          <span key={i} className="absolute rounded-full bg-[var(--paper-accent)]" style={{ left: x, top: y, width: r * 2, height: r * 2, opacity: 0.2 }} />
        ))}
      </Layer>
    )
  }

  if (deco === 'leaf') {
    return (
      <Layer>
        <LeafBranch className="absolute -left-3 bottom-[60px]" size={240} opacity={0.18} />
        <LeafBranch className="absolute -right-4 -top-2" size={210} opacity={0.14} flip />
        <LeafBranch className="absolute right-[30px] bottom-[24px]" size={130} opacity={0.1} />
        <span className="absolute left-[230px] bottom-[120px] h-2 w-2 rounded-full bg-[var(--paper-accent)] opacity-20" />
      </Layer>
    )
  }

  if (deco === 'blob') {
    return (
      <Layer>
        {/* 右上渐变气泡 */}
        <span
          className="absolute -right-10 -top-12 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, var(--paper-accent), transparent 72%)', opacity: 0.18 }}
        />
        <span
          className="absolute right-[92px] top-[54px] h-20 w-20 rounded-full"
          style={{ background: 'radial-gradient(circle at 40% 40%, var(--paper-accent), transparent 70%)', opacity: 0.12 }}
        />
        {/* 左下渐变气泡 */}
        <span
          className="absolute -left-12 bottom-[-36px] h-44 w-44 rounded-full"
          style={{ background: 'radial-gradient(circle at 55% 40%, var(--paper-accent), transparent 72%)', opacity: 0.14 }}
        />
        <span
          className="absolute left-[110px] bottom-[76px] h-16 w-16 rounded-full"
          style={{ background: 'radial-gradient(circle at 45% 45%, var(--paper-accent), transparent 70%)', opacity: 0.1 }}
        />
        {/* 描边气泡点缀 */}
        <span className="absolute right-[210px] top-[130px] h-6 w-6 rounded-full border-[5px] border-[var(--paper-accent)] opacity-15" />
        <span className="absolute left-[210px] bottom-[190px] h-3.5 w-3.5 rounded-full border-[3px] border-[var(--paper-accent)] opacity-15" />
      </Layer>
    )
  }

  if (deco === 'confetti') {
    const pieces: Array<{ x: number; y: number; r: number; kind: 'rect' | 'circle' | 'tri'; rot: number }> = [
      { x: 400, y: 40, r: 10, kind: 'rect', rot: 24 },
      { x: 452, y: 88, r: 7, kind: 'circle', rot: 0 },
      { x: 380, y: 120, r: 8, kind: 'tri', rot: -18 },
      { x: 498, y: 148, r: 9, kind: 'rect', rot: 42 },
      { x: 330, y: 66, r: 6, kind: 'circle', rot: 0 },
      { x: 60, y: 620, r: 9, kind: 'tri', rot: 30 },
      { x: 108, y: 668, r: 7, kind: 'rect', rot: -30 },
      { x: 40, y: 710, r: 6, kind: 'circle', rot: 0 },
      { x: 150, y: 730, r: 8, kind: 'rect', rot: 60 },
      { x: 470, y: 690, r: 8, kind: 'circle', rot: 0 },
      { x: 520, y: 724, r: 7, kind: 'tri', rot: 12 },
      { x: 420, y: 748, r: 6, kind: 'rect', rot: -45 },
    ]
    return (
      <Layer>
        {pieces.map((p, i) => {
          const common = { left: p.x, top: p.y, opacity: 0.16 + (i % 3) * 0.05, transform: `rotate(${p.rot}deg)` }
          if (p.kind === 'circle') return <span key={i} className="absolute rounded-full bg-[var(--paper-accent)]" style={{ ...common, width: p.r * 2, height: p.r * 2 }} />
          if (p.kind === 'rect') return <span key={i} className="absolute rounded-[2px] bg-[var(--paper-accent)]" style={{ ...common, width: p.r * 2, height: p.r }} />
          return (
            <svg key={i} className="absolute" width={p.r * 2} height={p.r * 2} viewBox="0 0 16 16" style={common}>
              <path d="M8 1L15 14H1L8 1Z" fill="var(--paper-accent)" />
            </svg>
          )
        })}
        {/* 彩带弧线 */}
        <svg className="absolute right-0 top-0" width="120" height="150" viewBox="0 0 120 150" fill="none" style={{ opacity: 0.16 }}>
          <path d="M112 4C60 30 40 70 66 118" stroke="var(--paper-accent)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </Layer>
    )
  }

  if (deco === 'halftone') {
    const gap = 14
    return (
      <Layer>
        {/* 右上大圆：内部网点由密到疏 */}
        <svg className="absolute -right-8 -top-8" width="220" height="220" viewBox="0 0 220 220" style={{ opacity: 0.16 }}>
          <defs>
            <clipPath id="halftone-circle"><circle cx="180" cy="40" r="160" /></clipPath>
          </defs>
          <g clipPath="url(#halftone-circle)">
            {Array.from({ length: 12 }).map((_, r) =>
              Array.from({ length: 12 }).map((_, c) => {
                const dist = Math.hypot(c * gap - 170, r * gap - 20) / 220
                const radius = Math.max(0.4, 4.2 * (1 - dist))
                return <circle key={`${r}-${c}`} cx={c * gap} cy={r * gap} r={radius} fill="var(--paper-accent)" />
              }),
            )}
          </g>
        </svg>
        {/* 左下实心四分之一圆 + 弧线 */}
        <span className="absolute -left-10 bottom-[-40px] h-28 w-28 rounded-full bg-[var(--paper-accent)] opacity-[0.1]" />
        <svg className="absolute left-0 bottom-0" width="170" height="120" viewBox="0 0 170 120" fill="none" style={{ opacity: 0.16 }}>
          <circle cx="10" cy="130" r="70" stroke="var(--paper-accent)" strokeWidth="1.6" />
          <circle cx="10" cy="130" r="96" stroke="var(--paper-accent)" strokeWidth="1.2" />
          <circle cx="10" cy="130" r="122" stroke="var(--paper-accent)" strokeWidth="1" />
        </svg>
      </Layer>
    )
  }

  if (deco === 'arch') {
    return (
      <Layer>
        {/* 右上拱门（莫兰迪拱形色块） */}
        <span className="absolute right-[36px] top-0 h-24 w-16 rounded-t-full bg-[var(--paper-accent)] opacity-[0.13]" />
        <span className="absolute right-[76px] top-0 h-32 w-16 rounded-t-full bg-[var(--paper-accent)] opacity-[0.09]" />
        <span className="absolute right-[116px] top-0 h-20 w-14 rounded-t-full bg-[var(--paper-accent)] opacity-[0.06]" />
        {/* 左下拱门 + 圆 */}
        <span className="absolute left-[40px] bottom-0 h-20 w-14 rounded-t-full bg-[var(--paper-accent)] opacity-[0.1]" />
        <span className="absolute left-[84px] bottom-0 h-28 w-16 rounded-t-full bg-[var(--paper-accent)] opacity-[0.07]" />
        <span className="absolute left-[150px] bottom-[92px] h-10 w-10 rounded-full border-[7px] border-[var(--paper-accent)] opacity-[0.14]" />
        <span className="absolute left-[196px] bottom-[52px] h-3 w-3 rounded-full bg-[var(--paper-accent)] opacity-20" />
      </Layer>
    )
  }

  return null
}
