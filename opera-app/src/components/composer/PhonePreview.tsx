import type { ComposerDraftImage } from '../../types';

interface PhonePreviewProps {
  title: string;
  body: string;
  tags: string[];
  /** 用户上传的全部图片：第一张作为封面，其余在正文下方网格展示 */
  images?: ComposerDraftImage[];
  /** 是否在正文中保留 emoji，emoji=false 时 strip 表情符 */
  useEmoji?: boolean;
}

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

function stripEmoji(text: string): string {
  return text.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();
}

/**
 * 手机预览（小红书风）：
 * - 外壳固定 280×580，状态栏/顶栏/底栏不滚，中间内容独立滚动
 * - 封面 = images[0] 或渐变占位 + 标题
 * - 页码与轮播圆点按 images.length 真实显示
 * - 正文下方按 images.slice(1) 渲染 3 列缩略图网格
 */
export default function PhonePreview({ title, body, tags, images = [], useEmoji = true }: PhonePreviewProps) {
  const displayBody = useEmoji ? body : stripEmoji(body);
  const truncatedTitle = title.length > 40 ? title.slice(0, 40) + '…' : title;
  const cover = images[0];
  const extraImages = images.slice(1);
  const totalSlides = Math.max(images.length, 1);

  return (
    <div className="relative w-[280px] shrink-0">
      {/* 手机外壳 */}
      <div className="relative rounded-[38px] bg-[#1c1917] p-[8px] shadow-float">
        <div className="opera-light-preview flex h-[580px] flex-col overflow-hidden rounded-[30px] bg-white">
          {/* 状态栏 + 灵动岛 — shrink-0 */}
          <div className="relative flex h-8 shrink-0 items-center justify-between bg-white px-5 text-[10px] font-semibold text-neutral-900">
            <span>9:41</span>
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1.5 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900"
            />
            <span className="inline-flex items-center gap-1">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 16 12">
                <rect x="0.5" y="6" width="2" height="5" rx="0.5" />
                <rect x="4" y="4" width="2" height="7" rx="0.5" />
                <rect x="7.5" y="2" width="2" height="9" rx="0.5" />
                <rect x="11" y="0" width="2" height="11" rx="0.5" />
              </svg>
              <svg className="h-2 w-3.5" fill="currentColor" viewBox="0 0 22 12">
                <rect x="0.5" y="2" width="18" height="8" rx="2" stroke="currentColor" fill="none" />
                <rect x="2" y="3.5" width="11" height="5" rx="0.5" />
                <rect x="20" y="4.5" width="1.5" height="3" rx="0.5" />
              </svg>
            </span>
          </div>

          {/* 小红书顶栏 — shrink-0 */}
          <div aria-hidden="true" className="flex h-7 shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-3 select-none">
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-accent-300 to-primary-400 text-[7px] font-bold text-white">
                创
              </span>
              <span className="text-[10px] font-medium text-neutral-700">创作者</span>
              <span className="rounded-full bg-[#FF2E4D] px-1.5 py-0.5 text-[8px] font-semibold text-white">
                关注
              </span>
            </div>
            <svg className="h-3 w-3 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </div>

          {/* 内容区 — flex-1 独立滚动 */}
          <div className="flex-1 overflow-y-auto phone-scrollbar">
            {/* 封面 3:4 */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-accent-300 via-accent-500 to-primary-400">
              {cover ? (
                <img src={cover.previewUrl} alt={cover.alt} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-end p-3">
                  <p className="font-serif text-sm font-extrabold leading-tight text-white drop-shadow-md line-clamp-4">
                    {truncatedTitle || '封面标题'}
                  </p>
                </div>
              )}
              {/* 页码 */}
              <span className="absolute right-2 top-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white">
                1/{totalSlides}
              </span>
              {/* 轮播圆点 */}
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {Array.from({ length: Math.min(totalSlides, 6) }, (_, i) => (
                  <span
                    key={i}
                    className={i === 0 ? 'h-1 w-3 rounded-full bg-white' : 'h-1 w-1 rounded-full bg-white/60'}
                  />
                ))}
              </div>
            </div>

            {/* 笔记标题 + 正文 + 标签 */}
            <div className="px-3 py-2">
              <h3 className="text-[11px] font-bold leading-snug text-neutral-900">
                {truncatedTitle || '笔记标题'}
              </h3>
              <p className="mt-1.5 text-[10px] leading-[1.65] text-neutral-700 whitespace-pre-wrap">
                {displayBody || '在这里看到正文预览…'}
              </p>

              {/* 配图缩略图网格（封面以外的图） */}
              {extraImages.length > 0 && (
                <div className="mt-2.5 grid grid-cols-3 gap-1">
                  {extraImages.slice(0, 9).map((img) => (
                    <div key={img.id} className="aspect-square overflow-hidden rounded-md bg-neutral-100">
                      <img src={img.previewUrl} alt={img.alt} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-medium text-accent-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 底部互动栏 — shrink-0 */}
          <div className="flex h-8 shrink-0 items-center gap-2 border-t border-neutral-100 px-3">
            <div className="flex-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-400">
              说点什么…
            </div>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-500">
              <svg className="h-3 w-3 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              1.2k
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-500">
              <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.32.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              收藏
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
