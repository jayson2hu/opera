/**
 * Header 顶部导航组件
 * - 品牌标识 + 产品说明
 * - 固定在页面顶部
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* 品牌标识 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
            <svg
              className="w-4.5 h-4.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-neutral-900 tracking-tight">
              Opera
            </span>
            <span className="hidden sm:inline text-xs text-neutral-400 font-medium">
              公众号 → 小红书
            </span>
          </div>
        </div>

        {/* 右侧说明 */}
        <span className="text-xs text-neutral-400">
          内容适配工具
        </span>
      </div>
    </header>
  );
}
