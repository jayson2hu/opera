import { useEffect, useRef, useState } from 'react';

interface UseTypingInput {
  /** 完整目标文本 */
  text: string;
  /** 是否启用打字效果。false 时立即返回完整 text + done=true */
  on: boolean;
  /** 总时长（毫秒） */
  duration?: number;
}

interface UseTypingResult {
  /** 当前已显示文本 */
  text: string;
  /** 是否打字完成 */
  done: boolean;
}

const DEFAULT_DURATION = 1200;

/**
 * 打字 hook：在 duration 内按线性比例从 0 推进到完整 text。
 *
 * - on=false: 立即输出完整 text 且 done=true（无 effect 干预）
 * - on=true: rAF 循环按比例推进 progress，结束后停止
 * - text/duration 变化时从头重新开始
 *
 * 实现说明：使用 `progress` 状态（字符索引）+ derived `shown`/`done`，
 * 避免在 effect 体内直接 setState（命中 react-hooks/set-state-in-effect 规则）。
 */
export function useTyping({ text, on, duration = DEFAULT_DURATION }: UseTypingInput): UseTypingResult {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!on) return;

    const startTime = performance.now();
    const totalLength = text.length;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const ratio = Math.min(1, elapsed / duration);
      // 在 rAF 回调里 setState，不命中 effect-body 规则
      setProgress(Math.floor(totalLength * ratio));
      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    // 第一帧推到 rAF 里，效果同 setState 但延迟一帧
    rafRef.current = requestAnimationFrame(() => {
      setProgress(0);
      step();
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [on, text, duration]);

  const shown = on ? text.slice(0, progress) : text;
  const done = !on || progress >= text.length;
  return { text: shown, done };
}
