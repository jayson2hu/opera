import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface SplitFlowProps {
  left: ReactNode;
  right: ReactNode;
}

const DEFAULT_LEFT_WIDTH = 440;
const MIN_LEFT_WIDTH = 340;
const MAX_LEFT_WIDTH = 620;
const WIDTH_STORAGE_KEY = 'opera-cfg-w';
const COLLAPSED_STORAGE_KEY = 'opera-cfg-collapsed';

function readPersistedWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, parsed));
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LEFT_WIDTH;
}

function readPersistedCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 工作台外壳：
 * - 桌面（>860px）：左列配置（默认 440px，可拖拽 340-620 / 一键折叠），右列结果 flex-1
 * - 移动（≤860px）：单栏 + 顶部"⚙ 配置 / ✦ 结果"分段切换
 *
 * 持久化：opera-cfg-w（宽度）、opera-cfg-collapsed（折叠态）
 */
export default function SplitFlow({ left, right }: SplitFlowProps) {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'config' | 'result'>('config');
  const [leftWidth, setLeftWidth] = useState<number>(() => readPersistedWidth());
  const [collapsed, setCollapsed] = useState<boolean>(() => readPersistedCollapsed());
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(leftWidth));
    } catch {
      // ignore
    }
  }, [leftWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (collapsed) return;
      event.preventDefault();
      dragStartRef.current = { startX: event.clientX, startWidth: leftWidth };
      setDragging(true);
    },
    [collapsed, leftWidth],
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const next = start.startWidth + (event.clientX - start.startX);
      const clamped = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, next));
      setLeftWidth(clamped);
    };
    const handleUp = () => {
      dragStartRef.current = null;
      setDragging(false);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleSeparatorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (collapsed) return;

      let nextWidth: number | null = null;
      if (event.key === 'ArrowLeft') nextWidth = leftWidth - 20;
      if (event.key === 'ArrowRight') nextWidth = leftWidth + 20;
      if (event.key === 'Home') nextWidth = MIN_LEFT_WIDTH;
      if (event.key === 'End') nextWidth = MAX_LEFT_WIDTH;
      if (nextWidth === null) return;

      event.preventDefault();
      setLeftWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, nextWidth)));
    },
    [collapsed, leftWidth],
  );

  // ─── 移动单栏布局 ─────────────────────────────
  if (isMobile) {
    return (
      <div className="flex min-h-[calc(100vh-116px)] w-full flex-col bg-neutral-50">
        <div className="sticky top-14 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-md gap-1 px-3 py-2">
            <SegmentBtn label="⚙ 配置" active={mobileView === 'config'} onClick={() => setMobileView('config')} />
            <SegmentBtn label="✦ 结果" active={mobileView === 'result'} onClick={() => setMobileView('result')} />
          </div>
        </div>
        <div className="flex-1 px-4 py-4">
          {mobileView === 'config' ? (
            <div className="space-y-6">
              {left}
              <button
                type="button"
                onClick={() => setMobileView('result')}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 cursor-pointer"
              >
                查看结果 ✦
              </button>
            </div>
          ) : (
            right
          )}
        </div>
      </div>
    );
  }

  // ─── 桌面分栏布局 ─────────────────────────────
  const asideWidth = collapsed ? 0 : leftWidth;

  return (
    <div className="relative flex h-[calc(100vh-116px)] w-full overflow-hidden">
      <aside
        id="opera-config-panel"
        style={{ width: asideWidth, maxWidth: asideWidth, minWidth: asideWidth }}
        className="flex-shrink-0 overflow-y-auto bg-white border-r border-neutral-200"
        aria-hidden={collapsed}
      >
        {!collapsed && <div className="p-6">{left}</div>}
      </aside>

      <div className="relative group">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整配置栏宽度"
          aria-controls="opera-config-panel"
          aria-hidden={collapsed}
          aria-valuemin={MIN_LEFT_WIDTH}
          aria-valuemax={MAX_LEFT_WIDTH}
          aria-valuenow={leftWidth}
          aria-valuetext={`${leftWidth} 像素`}
          tabIndex={collapsed ? -1 : 0}
          onMouseDown={onMouseDown}
          onKeyDown={handleSeparatorKeyDown}
          className={`
            relative h-full w-1.5 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500
            ${collapsed ? 'pointer-events-none opacity-0' : ''}
          `}
        >
          <div
            className={`
              absolute inset-y-0 left-1/2 w-px -translate-x-1/2
              ${dragging ? 'bg-primary-400' : 'bg-neutral-200 group-hover:bg-primary-300'}
              transition-colors
            `}
          />
        </div>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label={collapsed ? '展开配置栏' : '折叠配置栏'}
          aria-controls="opera-config-panel"
          aria-expanded={!collapsed}
          className="absolute top-1/2 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-card transition-all hover:border-primary-300 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer"
        >
          <svg
            className={`h-3 w-3 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <section className="flex-1 overflow-y-auto bg-neutral-50">
        <div className="p-6">{right}</div>
      </section>
    </div>
  );
}

interface SegmentBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function SegmentBtn({ label, active, onClick }: SegmentBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`
        flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer
        ${active ? 'bg-primary-500 text-white shadow-card' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}
      `}
    >
      {label}
    </button>
  );
}
