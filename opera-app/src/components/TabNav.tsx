import type { AppTab } from '../types';

interface TabNavProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: Array<{ id: AppTab; label: string; activeClass: string }> = [
  { id: 'wechat', label: '微信公众号', activeClass: 'border-emerald-500 text-emerald-600' },
  { id: 'adapter', label: '公众号转小红书', activeClass: 'border-primary-500 text-primary-600' },
  { id: 'composer', label: '小红书原创', activeClass: 'border-accent-500 text-accent-600' },
];

export default function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <div className="border-b border-neutral-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 pt-3 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={`
                shrink-0 pb-3 px-4 border-b-2 text-base transition-colors cursor-pointer
                ${
                  isActive
                    ? `${tab.activeClass} font-semibold`
                    : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
