interface WeChatInlineImgProps {
  caption: string;
  variant?: 'gradient-a' | 'gradient-b';
}

const VARIANT_BG: Record<NonNullable<WeChatInlineImgProps['variant']>, string> = {
  'gradient-a': 'bg-gradient-to-br from-primary-200 via-primary-300 to-amber-300',
  'gradient-b': 'bg-gradient-to-br from-emerald-200 via-teal-300 to-cyan-300',
};

/**
 * 公众号正文配图：保留版式预览所需的视觉占位与 caption，暂不提供上传操作。
 */
export default function WeChatInlineImg({ caption, variant = 'gradient-a' }: WeChatInlineImgProps) {
  return (
    <figure className="my-2">
      <div
        className={`relative block w-full overflow-hidden rounded-xl ${VARIANT_BG[variant]} aspect-[5/3]`}
        aria-hidden="true"
      />
      <figcaption className="mt-1.5 text-center text-xs text-neutral-400">{caption}</figcaption>
    </figure>
  );
}
