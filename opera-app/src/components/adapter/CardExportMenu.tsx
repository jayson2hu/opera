import { useEffect, useRef, useState } from 'react';

interface CardExportMenuProps {
  selectedCount: number;
  totalCount: number;
  onExportSelected: () => Promise<void>;
  onExportAll: () => Promise<void>;
}

export default function CardExportMenu({
  selectedCount,
  totalCount,
  onExportSelected,
  onExportAll,
}: CardExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const runExport = async (action: () => Promise<void>) => {
    setIsExporting(true);
    try {
      await action();
      setOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={isExporting || totalCount === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
        </svg>
        {isExporting ? '导出中…' : '导出图片'}
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-float">
          <button
            type="button"
            role="menuitem"
            disabled={selectedCount === 0 || isExporting}
            onClick={() => void runExport(onExportSelected)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            <span>导出选中</span>
            <span className="tabular-nums">{selectedCount}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isExporting}
            onClick={() => void runExport(onExportAll)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            <span>导出全部</span>
            <span className="tabular-nums">{totalCount}</span>
          </button>
        </div>
      )}
    </div>
  );
}
