import { useToast } from '../lib/toast';

/**
 * 全局 Toast：position:fixed 顶部居中、深色胶囊、绿色对勾、不推动布局。
 * 在 App 根挂载一次。
 */
export default function OperaToast() {
  const current = useToast();

  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[18px] z-[100] -translate-x-1/2"
    >
      <div
        key={current.id}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-neutral-900/95 px-4 py-2 text-sm font-medium text-white shadow-float backdrop-blur-sm animate-fade-in"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"
        >
          <svg
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
        <span>{current.message}</span>
      </div>
    </div>
  );
}
