import type { ReactNode } from 'react';

interface PaperProps {
  /** 文章标题 */
  title?: string;
  /** 元信息：作者 / 类型 / 字数 */
  author?: string;
  articleTypeLabel?: string;
  charCount?: number;
  /** 标题节点（替代 title，用于支持可编辑标题等） */
  titleNode?: ReactNode;
  children: ReactNode;
}

/**
 * 公众号文章纸张容器：白底大圆角 + 顶部 2px 绿色条 + 衬线大标题 + 元信息行。
 */
export default function Paper({ title, titleNode, author = '我的公众号', articleTypeLabel, charCount, children }: PaperProps) {
  const metaItems: string[] = [author];
  if (articleTypeLabel) metaItems.push(articleTypeLabel);
  if (typeof charCount === 'number') metaItems.push(`${charCount} 字`);

  return (
    <article className="overflow-hidden rounded-paper bg-white shadow-paper">
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500" />
      <div className="px-8 py-10 sm:px-14 sm:py-12">
        {titleNode ?? (
          title && (
            <h1 className="font-serif text-3xl leading-tight font-extrabold text-neutral-900 sm:text-[34px]">
              {title}
            </h1>
          )
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          {metaItems.map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-3">
              {index > 0 && <span aria-hidden="true">·</span>}
              <span>{item}</span>
            </span>
          ))}
        </div>
        <div className="mt-6 space-y-5">{children}</div>
      </div>
    </article>
  );
}
