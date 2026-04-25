import type { TagGroup } from '../types';
import CopyButton from './CopyButton';

interface HashtagGroupsProps {
  groups: TagGroup[];
}

const GROUP_STYLES: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  broad: {
    dot: 'bg-primary-400',
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    border: 'border-primary-200',
  },
  precise: {
    dot: 'bg-accent-400',
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
  },
  longtail: {
    dot: 'bg-success-500',
    bg: 'bg-success-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
};

export default function HashtagGroups({ groups }: HashtagGroupsProps) {
  if (groups.length === 0) return null;

  const allTags = groups
    .flatMap((g) => g.tags)
    .map((t) => `#${t}`)
    .join(' ');

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-800">
            话题标签
          </h3>
          <span className="text-xs text-neutral-400">
            {groups.reduce((sum, g) => sum + g.tags.length, 0)} 个标签
          </span>
        </div>
        <CopyButton text={allTags} label="复制全部标签" />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4 transition-all duration-200 hover:shadow-card">
        {groups.map((group) => {
          const style = GROUP_STYLES[group.type] ?? GROUP_STYLES.broad;
          return (
            <div key={group.type}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className="text-xs font-semibold text-neutral-600">
                  {group.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <TagChip
                    key={tag}
                    tag={tag}
                    bg={style.bg}
                    text={style.text}
                    border={style.border}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TagChip({
  tag,
  bg,
  text,
  border,
}: {
  tag: string;
  bg: string;
  text: string;
  border: string;
}) {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(`#${tag}`);
    } catch {
      // Copy failure is non-blocking.
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
        text-xs font-medium border transition-all duration-150
        cursor-pointer select-none
        hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]
        focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500
        ${bg} ${text} ${border}
      `}
      aria-label={`复制标签 #${tag}`}
    >
      <span className="opacity-50">#</span>
      {tag}
    </button>
  );
}
