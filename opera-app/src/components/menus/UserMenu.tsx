import { useEffect, useRef } from 'react';
import { useRecentDrafts } from '../../hooks/useRecentDrafts';

interface UserMenuProps {
  onClose: () => void;
  onOpenDrafts: () => void;
  onOpenPreferences: () => void;
  onOpenProfile: () => void;
}

const MENU_ITEMS = [
  { id: 'profile', label: '工作台状态', emoji: '👤' },
  { id: 'drafts', label: '我的草稿箱', emoji: '📂' },
  { id: 'prefs', label: '偏好设置', emoji: '⚙️' },
] as const;

/**
 * 头像菜单：本地工作台状态 + 草稿入口 + 偏好设置。
 * 点外部 / Esc 关闭。
 */
export default function UserMenu({ onClose, onOpenDrafts, onOpenPreferences, onOpenProfile }: UserMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const draftCount = useRecentDrafts(50).length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="账号菜单"
      className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-float animate-slide-up"
    >
      <div className="bg-gradient-to-br from-accent-400 via-accent-500 to-primary-400 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold backdrop-blur">
            创
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">本地工作台</span>
              <span className="rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-bold tracking-wide backdrop-blur">LOCAL</span>
            </div>
            <div className="truncate text-[11px] opacity-85">未登录 · 无云端账号</div>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-[11px] opacity-90 backdrop-blur">
          当前浏览器 · {draftCount} 个本地草稿
        </div>
      </div>

      <ul className="py-1">
        {MENU_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (item.id === 'drafts') onOpenDrafts();
                else if (item.id === 'prefs') onOpenPreferences();
                else if (item.id === 'profile') onOpenProfile();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 cursor-pointer"
            >
              <span aria-hidden="true" className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
