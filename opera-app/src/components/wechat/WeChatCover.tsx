interface WeChatCoverProps {
  title?: string;
}

/**
 * 公众号封面头图：2:1 渐变视觉占位。真实图片上传暂未接入，因此保持为非交互展示。
 */
export default function WeChatCover({ title }: WeChatCoverProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      <div className="aspect-[2/1] w-full bg-gradient-to-br from-emerald-300 via-emerald-500 to-green-600">
        <div className="flex h-full items-end p-6">
          {title && (
            <p className="font-serif text-2xl font-extrabold text-white drop-shadow-md sm:text-3xl line-clamp-3">
              {title}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
