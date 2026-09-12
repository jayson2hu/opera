import type { ToneType } from '../types';
import { TONE_OPTIONS } from '../constants';
import type { CfgTone } from './shared/CfgGroup';
import ChipPicker, { type ChipOption } from './shared/ChipPicker';

interface ToneSelectorProps {
  selected: ToneType | null;
  onSelect: (tone: ToneType) => void;
  disabled?: boolean;
  /** 主色调，按 Page 传入：公众号 emerald / 改写 primary / 小红书 accent。默认 primary */
  tone?: CfgTone;
}

export default function ToneSelector({
  selected,
  onSelect,
  disabled = false,
  tone = 'primary',
}: ToneSelectorProps) {
  const options: ChipOption<ToneType>[] = TONE_OPTIONS.map((t) => ({
    id: t.id,
    emoji: t.emoji,
    label: t.label,
    subtitle: t.subtitle,
    description: t.description,
    example: t.example,
  }));

  return (
    <ChipPicker
      options={options}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      tone={tone}
      ariaLabel="选择语气"
    />
  );
}
