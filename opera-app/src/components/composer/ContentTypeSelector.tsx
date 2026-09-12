import { CONTENT_TYPE_OPTIONS } from '../../constants';
import type { ContentType } from '../../types';
import ChipPicker, { type ChipOption } from '../shared/ChipPicker';

interface ContentTypeSelectorProps {
  selected: ContentType | null;
  onSelect: (value: ContentType) => void;
  disabled?: boolean;
}

export default function ContentTypeSelector({
  selected,
  onSelect,
  disabled = false,
}: ContentTypeSelectorProps) {
  const options: ChipOption<ContentType>[] = CONTENT_TYPE_OPTIONS.map((opt) => ({
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
      tone="accent"
      ariaLabel="内容类型"
    />
  );
}
