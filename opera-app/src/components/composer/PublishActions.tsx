import { useCallback, useState } from 'react';

interface PublishActionsProps {
  text: string;
}

export default function PublishActions({ text }: PublishActionsProps) {
  const [copied, setCopied] = useState(false);
  const canCopy = text.trim().length > 0;

  const handleCopy = useCallback(async () => {
    if (!canCopy) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [canCopy, text]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canCopy}
        className={
          canCopy
            ? 'px-6 py-2.5 rounded-2xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-md shadow-accent-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer'
            : 'px-6 py-2.5 rounded-2xl text-sm font-semibold bg-neutral-200 text-neutral-400 cursor-not-allowed'
        }
      >
        {copied ? '已复制全文' : '复制全文'}
      </button>
      <button
        type="button"
        disabled
        title="发布能力即将上线"
        className="px-6 py-2.5 rounded-2xl text-sm font-medium border border-neutral-200 text-neutral-300 cursor-not-allowed"
      >
        即将上线
      </button>

    </div>
  );
}
