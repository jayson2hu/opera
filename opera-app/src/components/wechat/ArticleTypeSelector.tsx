import { WECHAT_ARTICLE_TYPE_OPTIONS } from '../../constants';
import type { WeChatArticleType } from '../../types';
import ChipPicker, { type ChipOption } from '../shared/ChipPicker';

interface ArticleTypeSelectorProps {
  selected: WeChatArticleType | null;
  onSelect: (value: WeChatArticleType) => void;
  disabled?: boolean;
}

export default function ArticleTypeSelector({
  selected,
  onSelect,
  disabled = false,
}: ArticleTypeSelectorProps) {
  const options: ChipOption<WeChatArticleType>[] = WECHAT_ARTICLE_TYPE_OPTIONS.map((opt) => ({
    id: opt.id,
    emoji: opt.emoji,
    label: opt.label,
    description: opt.description,
  }));

  return (
    <ChipPicker
      options={options}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      tone="emerald"
      ariaLabel="文章类型"
    />
  );
}
