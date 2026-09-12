import { useId } from 'react';
import { getQualityChecks, type QualityInput } from '../../lib/qualityChecks';

export default function PublishChecklist(input: QualityInput) {
  const checks = getQualityChecks(input);
  const id = useId();
  const allPassed = checks.filter((check) => !check.manual).every((check) => check.pass);
  return <section aria-labelledby={id} className="space-y-4 border-t border-neutral-200 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 id={id} className="text-sm font-semibold text-neutral-800">交付前基础检查</h3>
        <p className="mt-1 text-xs text-neutral-500">按当前稿件的来源篇幅检查；下一次生成配置不会改变已有稿件标准。</p></div>
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">{allPassed ? '基础项达到 · 仍需人工审核' : '有待检查项'}</span>
    </div>
    <ul className="grid gap-2 sm:grid-cols-2">{checks.map((check) =>
      <li key={check.id} className="flex min-h-11 items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2.5">
        <span aria-hidden="true" className={check.pass ? 'text-emerald-600' : 'text-amber-600'}>{check.manual ? '○' : check.pass ? '✓' : '!'}</span>
        <span><span className="block text-xs font-medium text-neutral-700">{check.label}{check.manual ? ' · 人工核验' : ''}</span>
          <span className="mt-1 block text-[11px] leading-5 text-neutral-500">{check.detail}</span></span>
      </li>)}</ul>
    <p className="rounded-lg bg-accent-50 px-3 py-2.5 text-xs leading-5 text-accent-800">字数按非空白字符计算（含标点）。这里只检查可解释的基础项，不预测阅读量、互动率，也不代表平台审核通过。</p>
  </section>;
}
