import { useCallback, useState } from 'react';

interface CopyButtonProps {
  text: string;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export default function CopyButton({
  text,
  size = 'sm',
  label = '复制',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs gap-1'
      : 'px-3.5 py-1.5 text-sm gap-1.5';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? '已复制' : label}
      className={`
        inline-flex items-center rounded-lg font-medium
        transition-all duration-200 cursor-pointer select-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
        ${
          copied
            ? 'bg-success-50 text-success-500 border border-success-500/20'
            : 'bg-white text-neutral-500 border border-neutral-200 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50'
        }
        ${sizeClasses}
        ${className}
      `}
    >
      {copied ? (
        <>
          <svg
            className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span>已复制</span>
        </>
      ) : (
        <>
          <svg
            className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
