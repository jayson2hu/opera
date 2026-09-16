import { useEffect, useState, type ReactNode } from 'react';
import './exploration.css';

type ConceptId = 'a' | 'b' | 'c';
type DemoScreen = 'login' | 'dashboard' | 'workspace' | 'settings';
type LabView = 'compare' | DemoScreen;

interface ConceptMeta {
  id: ConceptId;
  eyebrow: string;
  name: string;
  shortName: string;
  thesis: string;
  reference: string;
  colors: string[];
  strengths: string[];
  risks: string[];
  scores: [number, number, number, number];
}

const CONCEPTS: ConceptMeta[] = [
  {
    id: 'a',
    eyebrow: 'CONCEPT A',
    name: 'Signal Desk',
    shortName: '现代 SaaS',
    thesis: '把 Opera 变成清晰、可靠、高信息密度的内容生产控制台。',
    reference: 'Linear · Vercel · Stripe',
    colors: ['#111318', '#5E6AD2', '#F5F6F8', '#FFFFFF'],
    strengths: ['学习成本低', '复杂任务可扫描', '适合高频专业用户'],
    risks: ['品牌个性较弱', 'AI 过程仍偏工具化'],
    scores: [5, 3, 3, 5],
  },
  {
    id: 'b',
    eyebrow: 'CONCEPT B',
    name: 'Agent Canvas',
    shortName: 'AI 原生',
    thesis: '让 Agent 负责推进流程，用户在关键决策点确认、编辑并接管结果。',
    reference: 'Claude · ChatGPT · Cursor',
    colors: ['#1E201D', '#D97757', '#F4F1EA', '#8EA68F'],
    strengths: ['最贴合 AI 产品心智', '过程透明、可干预', '新手起步自然'],
    risks: ['长对话可能难回看', '需要控制 Agent 自主边界'],
    scores: [4, 5, 5, 4],
  },
  {
    id: 'c',
    eyebrow: 'CONCEPT C',
    name: 'Opera Atelier',
    shortName: '高级商业',
    thesis: '把内容创作塑造成专注、沉浸、具有仪式感的高级创作体验。',
    reference: 'Apple · Arc · Raycast',
    colors: ['#07080B', '#8B5CF6', '#D6FF66', '#F6F3FF'],
    strengths: ['品牌记忆最强', '创作氛围出色', '适合高价值定位'],
    risks: ['信息密度较低', '视觉实现与维护成本高'],
    scores: [3, 4, 4, 2],
  },
];

const SCREEN_LABELS: Array<{ id: DemoScreen; label: string }> = [
  { id: 'login', label: '登录页' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'workspace', label: '核心工作台' },
  { id: 'settings', label: '设置' },
];

type IconName =
  | 'sparkle' | 'home' | 'file' | 'settings' | 'command' | 'plus' | 'search'
  | 'clock' | 'check' | 'copy' | 'arrow' | 'message' | 'wand' | 'layers'
  | 'shield' | 'sliders' | 'palette' | 'moon' | 'send' | 'panel' | 'bookmark'
  | 'more' | 'user' | 'bell' | 'eye' | 'upload' | 'grid' | 'edit' | 'image';

const ICON_PATHS: Record<IconName, ReactNode> = {
  sparkle: <><path d="m12 3 1.25 4.05L17 8.5l-3.75 1.45L12 14l-1.25-4.05L7 8.5l3.75-1.45L12 3Z"/><path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75.75-2.25Z"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06L3.2 16.94l.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-1.5-1H2v-4h.1A1.7 1.7 0 0 0 3.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.06 4.2l.06.06A1.7 1.7 0 0 0 8 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  command: <><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  message: <><path d="M4 5h16v11H8l-4 4z"/></>,
  wand: <><path d="m4 20 10-10M12 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM18 13l.7 2.3L21 16l-2.3.7L18 19l-.7-2.3L15 16l2.3-.7L18 13Z"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.4a1.6 1.6 0 0 0 1.1-2.7 1.6 1.6 0 0 1 1.1-2.7H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10" r=".7"/><circle cx="10" cy="6.5" r=".7"/><circle cx="15" cy="7" r=".7"/></>,
  moon: <><path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></>,
  send: <><path d="m3 11 18-8-8 18-2-8-8-2Z"/><path d="m11 13 5-5"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  bookmark: <><path d="M6 4h12v17l-6-4-6 4z"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></>,
  eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m21 15-5-5L5 20"/></>,
};

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[name]}</svg>;
}

function OperaMark({ compact = false }: { compact?: boolean }) {
  return <span className="opera-mark"><span className="opera-mark-glyph">O</span>{!compact && <span>opera</span>}</span>;
}

function readInitialState(): { concept: ConceptId; view: LabView } {
  const params = new URLSearchParams(window.location.search);
  const concept = params.get('concept');
  const screen = params.get('screen');
  return {
    concept: concept === 'b' || concept === 'c' ? concept : 'a',
    view: SCREEN_LABELS.some((item) => item.id === screen) ? screen as DemoScreen : 'compare',
  };
}

export default function UiExploration() {
  const [initial] = useState(() => readInitialState());
  const [concept, setConcept] = useState<ConceptId>(initial.concept);
  const [view, setView] = useState<LabView>(initial.view);
  const activeConcept = CONCEPTS.find((item) => item.id === concept) ?? CONCEPTS[0];

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('concept', concept);
    if (view !== 'compare') params.set('screen', view);
    window.history.replaceState(null, '', `/explore?${params.toString()}`);
  }, [concept, view]);

  const openConcept = (id: ConceptId, screen: DemoScreen = 'dashboard') => {
    setConcept(id);
    setView(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="ui-lab">
      <header className="lab-header">
        <a href="/" className="lab-brand" aria-label="返回 Opera 当前产品">
          <OperaMark />
          <span className="lab-divider" />
          <span className="lab-title">UI Exploration</span>
          <span className="lab-phase">PHASE 01</span>
        </a>
        <nav className="lab-nav" aria-label="设计探索导航">
          <button className={view === 'compare' ? 'is-active' : ''} onClick={() => setView('compare')}>方案对比</button>
          {CONCEPTS.map((item) => (
            <button key={item.id} className={concept === item.id && view !== 'compare' ? 'is-active' : ''} onClick={() => openConcept(item.id)}>
              <span>{item.id.toUpperCase()}</span>{item.shortName}
            </button>
          ))}
        </nav>
        <a className="lab-back" href="/"><Icon name="arrow" size={14} /> 当前产品</a>
      </header>

      {view === 'compare' ? (
        <ComparisonPage onOpen={openConcept} />
      ) : (
        <PrototypePage concept={activeConcept} screen={view} onScreenChange={setView} onNavigate={setView} />
      )}
    </div>
  );
}

function ComparisonPage({ onOpen }: { onOpen: (id: ConceptId, screen?: DemoScreen) => void }) {
  return (
    <main className="lab-main">
      <section className="lab-hero">
        <div>
          <span className="lab-kicker"><Icon name="sparkle" size={14} /> Opera / Interface futures</span>
          <h1>不是换主题，<br/><em>是选择下一种工作方式。</em></h1>
        </div>
        <div className="lab-hero-note">
          <span>探索命题</span>
          <p>如何让独立创作者更快地从想法或长文，获得一份可信、可编辑、可交付的内容成品？</p>
          <div><b>3</b> 设计方向 <i/> <b>12</b> 核心页面 <i/> <b>0</b> 业务逻辑改动</div>
        </div>
      </section>

      <section className="diagnosis-section">
        <div className="section-heading">
          <span>01 / CURRENT STATE</span>
          <h2>先看清现在的 Opera</h2>
          <p>当前核心瓶颈不是“AI 能不能写”，而是用户能否理解过程、接管结果并高效交付。</p>
        </div>
        <div className="diagnosis-grid">
          <article><span>产品定位</span><h3>AI 内容创作工作台</h3><p>围绕公众号与小红书的原创、改写和交付；本地草稿优先，不是发布平台。</p></article>
          <article><span>核心用户</span><h3>高频独立创作者</h3><p>知识、职场、教育、生活方式领域，已有内容资产，但跨平台复用成本高。</p></article>
          <article><span>三条主流程</span><h3>原创 · 改写 · 长文</h3><p>主题生成小红书、公众号转小红书、主题生成公众号文章。</p></article>
          <article className="diagnosis-alert"><span>真实阻力</span><h3>过程断裂，交付分散</h3><p>首页按功能分流，但生成、校对、版本、复制与导出缺少统一的“作品”心智。</p></article>
        </div>
        <div className="issue-strip">
          <span>当前 UI / IA 问题</span>
          <ul>
            <li>Header、首页、流程页都在重复承担导航</li>
            <li>三条流程的编辑模型相近，但交互骨架不够统一</li>
            <li>生成过程与最终内容分离，用户难以理解 AI 的决策</li>
            <li>草稿、版本、候选和交付动作分散在抽屉、顶部栏与内容底部</li>
            <li>现有暖色卡片风格友好，但专业密度与品牌辨识度仍可提升</li>
          </ul>
        </div>
      </section>

      <section className="concept-section">
        <div className="section-heading row-heading">
          <div><span>02 / THREE DIRECTIONS</span><h2>三套完全不同的产品性格</h2></div>
          <p>每套均含登录页、Dashboard、核心工作台和设置页。点击进入可交互原型。</p>
        </div>
        <div className="concept-grid">
          {CONCEPTS.map((item) => <ConceptCard key={item.id} concept={item} onOpen={() => onOpen(item.id)} />)}
        </div>
      </section>

      <section className="matrix-section">
        <div className="section-heading"><span>03 / TRADE-OFFS</span><h2>不是谁更漂亮，而是谁更适合当前阶段</h2></div>
        <div className="matrix-wrap">
          <table>
            <thead><tr><th>评估维度</th><th>A · Signal Desk</th><th className="recommended-col">B · Agent Canvas <b>推荐</b></th><th>C · Opera Atelier</th></tr></thead>
            <tbody>
              {['上手清晰度', 'AI 过程可理解性', '人工接管能力', 'MVP 实施效率'].map((label, index) => (
                <tr key={label}><td>{label}</td>{CONCEPTS.map((item) => <td key={item.id}>{Array.from({ length: 5 }, (_, score) => <i key={score} className={score < item.scores[index] ? 'filled' : ''} />)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="recommendation">
        <div className="recommendation-index">04</div>
        <div className="recommendation-copy">
          <span>RECOMMENDED DIRECTION</span>
          <h2>选择 B：Agent Canvas</h2>
          <p>Opera 的差异化不应只是“更漂亮的编辑器”，而应是让 AI 的思考与用户的判断在同一个工作流里协作。B 最直接地解决当前的核心问题：用户看得见过程、能在关键点干预，并始终保有对最终作品的控制。</p>
          <div className="recommendation-rule"><b>建议融合：</b>以 B 的 Agent 交互为主干，吸收 A 的高密度作品/版本管理；暂不采用 C 的重视觉外壳，保留其品牌语汇用于营销页与关键高光时刻。</div>
        </div>
        <button onClick={() => onOpen('b')}><span>打开推荐原型</span><Icon name="arrow" size={18} /></button>
      </section>
    </main>
  );
}

function ConceptCard({ concept, onOpen }: { concept: ConceptMeta; onOpen: () => void }) {
  return (
    <article className={`concept-card concept-card-${concept.id}`}>
      <div className="concept-card-head"><div><span>{concept.eyebrow}</span><h3>{concept.name}</h3></div><em>{concept.shortName}</em></div>
      <PreviewPoster concept={concept.id} />
      <p>{concept.thesis}</p>
      <div className="concept-reference">Inspired by {concept.reference}</div>
      <div className="concept-tradeoffs">
        <div><span>优势</span><p>{concept.strengths.join(' · ')}</p></div>
        <div><span>风险</span><p>{concept.risks.join(' · ')}</p></div>
      </div>
      <div className="concept-colors">{concept.colors.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
      <div className="concept-card-foot"><span>4 个可交互页面</span><button onClick={onOpen}>查看原型 <Icon name="arrow" size={14} /></button></div>
    </article>
  );
}

function PreviewPoster({ concept }: { concept: ConceptId }) {
  const poster = concept === 'a'
    ? <div className="poster poster-a"><div className="poster-a-side"><b>O</b>{[1,2,3,4].map(i => <i key={i}/>)}</div><div className="poster-a-main"><header><span/><i/></header><div className="poster-a-title"/><div className="poster-a-cards">{[1,2,3].map(i => <i key={i}/>)}</div><div className="poster-a-list">{[1,2,3].map(i => <i key={i}/>)}</div></div></div>
    : concept === 'b'
      ? <div className="poster poster-b"><div className="poster-b-side"><b>O</b>{[1,2,3,4].map(i => <i key={i}/>)}</div><div className="poster-b-main"><span>Good morning, Lin.</span><h4>What will we make today?</h4><div className="poster-b-prompt"><i/><b>↑</b></div><div className="poster-b-chips">{[1,2,3].map(i => <i key={i}/>)}</div></div></div>
      : <div className="poster poster-c"><span className="poster-c-orb"/><header><b>OPERA</b><i>STUDIO 03</i></header><div className="poster-c-copy"><span>Today’s canvas</span><h4>Turn quiet ideas<br/>into lasting work.</h4><button>Begin creating →</button></div><div className="poster-c-stack"><i/><i/><i/></div></div>;
  return <div className="concept-snapshot"><div><span>SCREENSHOT PREVIEW</span><b>DASHBOARD</b></div>{poster}</div>;
}

function PrototypePage({ concept, screen, onScreenChange, onNavigate }: { concept: ConceptMeta; screen: DemoScreen; onScreenChange: (view: LabView) => void; onNavigate: (view: LabView) => void }) {
  return (
    <main className="prototype-main">
      <div className="prototype-toolbar">
        <div><span>{concept.eyebrow}</span><h1>{concept.name}</h1><p>{concept.thesis}</p></div>
        <nav aria-label="原型页面">
          {SCREEN_LABELS.map((item) => <button key={item.id} className={screen === item.id ? 'is-active' : ''} onClick={() => onScreenChange(item.id)}>{item.label}</button>)}
        </nav>
        <button className="prototype-compare" onClick={() => onScreenChange('compare')}>返回对比</button>
      </div>
      <div className={`prototype-stage prototype-${concept.id}`}>
        {concept.id === 'a' && <SaasConcept screen={screen} onNavigate={onNavigate} />}
        {concept.id === 'b' && <AiConcept screen={screen} onNavigate={onNavigate} />}
        {concept.id === 'c' && <PremiumConcept screen={screen} onNavigate={onNavigate} />}
      </div>
      <ConceptSpec concept={concept} />
    </main>
  );
}

function ConceptSpec({ concept }: { concept: ConceptMeta }) {
  const specs: Record<ConceptId, Array<[string, string]>> = {
    a: [
      ['设计理念', '可信赖的内容生产控制台；让状态、版本和下一步始终清晰。'],
      ['体验目标', '减少找功能和回忆上下文的成本，服务高频、并行创作。'],
      ['色彩 / 字体', 'Graphite + Indigo；Inter / 系统无衬线，12–14px 高密度正文。'],
      ['布局 / 导航', '固定左侧栏 + 顶部命令栏 + 模块化工作区；作品是一级对象。'],
      ['首页 / 核心页', '首页展示进行中作品和快捷流程；核心页使用三栏输入、提取、交付。'],
      ['数据 / 组件', '表格、状态点、紧凑图表；8px 圆角、1px 边框、弱阴影、明确焦点态。'],
    ],
    b: [
      ['设计理念', 'Agent 推进，用户决策；对话不是聊天装饰，而是工作流本身。'],
      ['体验目标', '让新手知道该说什么，让专业用户随时接管并检查 AI 的过程。'],
      ['色彩 / 字体', 'Warm Paper + Clay + Sage；人文无衬线搭配编辑区衬线。'],
      ['布局 / 导航', '会话侧栏 + 对话主线 + Artifact 画布；按作品组织上下文。'],
      ['首页 / 核心页', '首页从自然语言目标开始；核心页把提取要点设为明确确认节点。'],
      ['数据 / 组件', 'Agent 状态时间线、引用卡、可接管 Artifact；14–16px、柔和 14px 圆角。'],
    ],
    c: [
      ['设计理念', '数字创作工作室；通过空间、光感和节奏强化专注与作品价值。'],
      ['体验目标', '降低工具感，建立高级品牌认知，让创作过程有仪式感。'],
      ['色彩 / 字体', 'Obsidian + Electric Violet + Acid Lime；展示衬线 + 精密无衬线。'],
      ['布局 / 导航', '悬浮侧轨 + 空间化画布 + 命令坞；弱化传统页面边界。'],
      ['首页 / 核心页', '首页以作品舞台和连续创作为中心；核心页是无边界编辑画布。'],
      ['数据 / 组件', '大数字、光带与极简图表；玻璃层、24px 圆角、富动效层级。'],
    ],
  };
  return <section className="concept-spec"><div className="concept-spec-title"><span>DESIGN SYSTEM</span><h2>{concept.name} 设计规范</h2></div><div className="concept-spec-grid">{specs[concept.id].map(([label, value]) => <article key={label}><span>{label}</span><p>{value}</p></article>)}</div><div className="concept-pros-cons"><div><span>优势</span>{concept.strengths.map(item => <p key={item}><Icon name="check" size={14}/>{item}</p>)}</div><div><span>风险</span>{concept.risks.map(item => <p key={item}><b>!</b>{item}</p>)}</div></div></section>;
}

function SaasConcept({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  if (screen === 'login') return <SaasLogin onEnter={() => onNavigate('dashboard')} />;
  return <div className="a-shell"><SaasSidebar screen={screen} onNavigate={onNavigate}/><div className="a-content"><SaasTopbar />{screen === 'dashboard' && <SaasDashboard onNavigate={onNavigate}/>} {screen === 'workspace' && <SaasWorkspace/>} {screen === 'settings' && <SaasSettings/>}</div></div>;
}

function SaasLogin({ onEnter }: { onEnter: () => void }) {
  return <div className="a-login"><aside><OperaMark/><div><span>THE CONTENT OPERATING SYSTEM</span><h2>From source<br/>to publish-ready.</h2><p>One focused workspace for drafting, adapting and shipping your best ideas.</p></div><footer>Private by default · Drafts stay local</footer></aside><main><div className="a-login-card"><span className="a-login-kicker">WELCOME TO OPERA</span><h1>Continue to your workspace</h1><p>登录页为未来概念验证，当前 Opera 仍无需账号。</p><button className="a-oauth"><b>G</b> Continue with Google</button><div className="a-or"><i/>or continue with email<i/></div><label>Work email<input type="email" placeholder="you@studio.com"/></label><button className="a-primary" onClick={onEnter}>Continue <Icon name="arrow" size={15}/></button><small>By continuing, you agree to the Terms and Privacy Policy.</small></div></main></div>;
}

function SaasSidebar({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  return <aside className="a-sidebar"><div className="a-logo"><OperaMark compact/><span>Opera</span><button><Icon name="panel" size={14}/></button></div><button className="a-new" onClick={() => onNavigate('workspace')}><Icon name="plus" size={14}/> New creation <kbd>N</kbd></button><nav><span>WORKSPACE</span><button className={screen === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}><Icon name="home"/>Overview</button><button className={screen === 'workspace' ? 'active' : ''} onClick={() => onNavigate('workspace')}><Icon name="edit"/>Content desk</button><button><Icon name="file"/>All drafts <b>12</b></button><button><Icon name="layers"/>Templates</button><span>LIBRARY</span><button><Icon name="bookmark"/>Saved sources</button><button><Icon name="clock"/>Version history</button></nav><div className="a-sidebar-bottom"><button className={screen === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}><Icon name="settings"/>Settings</button><div className="a-profile"><i>YL</i><span><b>Yun Lin</b><small>Creator workspace</small></span><Icon name="more"/></div></div></aside>;
}

function SaasTopbar() {
  return <header className="a-topbar"><button className="a-search"><Icon name="search" size={14}/>Search drafts, sources, actions…<kbd>⌘ K</kbd></button><div><span className="a-sync"><i/>Saved locally</span><button aria-label="通知"><Icon name="bell" size={15}/></button><button className="a-avatar">YL</button></div></header>;
}

function SaasDashboard({ onNavigate }: { onNavigate: (view: LabView) => void }) {
  return <main className="a-page"><div className="a-page-heading"><div><span>MONDAY, SEP 15</span><h1>Good morning, Yun.</h1><p>You have 3 works in progress and one draft ready to export.</p></div><button onClick={() => onNavigate('workspace')}><Icon name="plus" size={15}/> New creation</button></div><section className="a-stat-grid"><article><span>Drafts this month <Icon name="file"/></span><strong>18</strong><small><b>+24%</b> from August</small></article><article><span>Ready to publish <Icon name="check"/></span><strong>06</strong><small>2 need a final review</small></article><article><span>Words created <Icon name="edit"/></span><strong>32.4k</strong><small><b>8.2k</b> this week</small></article><article><span>Current streak <Icon name="sparkle"/></span><strong>7 days</strong><small>Personal best: 12 days</small></article></section><section className="a-dashboard-grid"><div className="a-panel a-recent"><header><div><h2>Recent work</h2><p>Continue where you left off</p></div><button>View all</button></header><div className="a-table-head"><span>WORK</span><span>FLOW</span><span>STATUS</span><span>UPDATED</span><span/></div>{[['AI 时代，普通人的稀缺能力','公众号 → 小红书','Ready','8 min'],['自由职业三年，我重新理解效率','公众号长文','Editing','2 hr'],['停止无效努力的 5 个信号','小红书原创','Draft','Yesterday'],['知识博主的内容复利系统','公众号 → 小红书','Review','Sep 12']].map((row, index) => <button className="a-table-row" key={row[0]} onClick={() => index === 0 && onNavigate('workspace')}><span><i className={`a-doc-icon a-doc-${index}`}>{index === 1 ? '微' : '小'}</i><b>{row[0]}</b></span><span>{row[1]}</span><span><em className={`a-status a-status-${row[2].toLowerCase()}`}/>{row[2]}</span><span>{row[3]}</span><span><Icon name="more" size={15}/></span></button>)}</div><div className="a-panel a-flows"><header><div><h2>Start a flow</h2><p>Choose your output</p></div></header>{[['wand','Adapt to Xiaohongshu','Turn a long article into a complete note package'],['edit','Write Xiaohongshu','Create a visual-first social post from an idea'],['file','Write WeChat article','Develop a topic into a structured long-form article']].map(([icon,title,desc], index) => <button key={title} onClick={() => onNavigate('workspace')}><i className={`a-flow-icon a-flow-${index}`}><Icon name={icon as IconName}/></i><span><b>{title}</b><small>{desc}</small></span><Icon name="arrow"/></button>)}</div></section></main>;
}

function SaasWorkspace() {
  const [point, setPoint] = useState(0);
  return <main className="a-workspace"><header className="a-workspace-head"><div><span className="a-breadcrumb">Content desk / Adaptation</span><h1>AI 时代，普通人的稀缺能力</h1></div><div><span><i/>Autosaved 10:42</span><button><Icon name="eye"/>Preview</button><button className="a-dark-btn"><Icon name="upload"/>Export</button></div></header><div className="a-workspace-tabs"><button className="active">Compose</button><button>Versions <b>4</b></button><button>Quality checks <b>2</b></button></div><div className="a-workspace-grid"><section className="a-source-panel"><header><span>01</span><div><h2>Source & direction</h2><p>1,842 characters · WeChat article</p></div><button><Icon name="more"/></button></header><div className="a-source-text"><h3>为什么越努力，越容易陷入平庸？</h3><p>过去十年，我们被反复告知：只要足够努力，就一定能够获得想要的结果。</p><p>但 AI 正在改变这套逻辑。执行的成本越来越低，真正稀缺的，是判断什么值得做，以及如何提出一个好问题。</p><p>未来的竞争不再是谁完成得更多，而是谁能更早识别真正重要的问题……</p></div><div className="a-config"><span>Direction</span><button>Knowledge</button><button>Clear & direct</button><button>600–900 words</button></div></section><section className="a-reason-panel"><header><span>02</span><div><h2>Key ideas</h2><p>Confirm what the AI should preserve</p></div><em>REVIEW REQUIRED</em></header><div className="a-reason-note"><Icon name="sparkle"/><p>Opera found 4 ideas that carry the article. Select one to inspect or edit its role.</p></div>{['努力正在从优势变成基础设施','判断力比执行力更稀缺','好问题决定 AI 输出的上限','建立个人问题库是新的复利'].map((text,index) => <button key={text} className={point === index ? 'active' : ''} onClick={() => setPoint(index)}><i>{index+1}</i><span><b>{text}</b><small>{['核心冲突 · 作为开头钩子','主要论点 · 保留原文案例','方法论 · 展开为 3 个步骤','行动建议 · 作为结尾'][index]}</small></span><Icon name="check"/></button>)}<footer><button><Icon name="plus"/>Add idea</button><button className="a-primary">Confirm & continue <Icon name="arrow"/></button></footer></section><section className="a-output-panel"><header><span>03</span><div><h2>Output package</h2><p>Last generated 10:40</p></div><button><Icon name="more"/></button></header><div className="a-output-section"><span>COVER TITLE <b>18 / 20</b></span><h3 contentEditable suppressContentEditableWarning>AI 时代，最稀缺的不是努力</h3><button><Icon name="copy"/></button></div><div className="a-slide-preview"><header><span>SLIDE CARDS</span><b>6 cards</b></header><div><i>01</i><span><small>OPENING HOOK</small><strong>你有没有发现：<br/>越努力，反而越容易<br/>陷入平庸？</strong></span></div><footer>{[1,2,3,4,5,6].map(i => <i key={i} className={i===1?'active':''}/>)}</footer></div><div className="a-output-actions"><button><Icon name="edit"/>Edit copy</button><button><Icon name="copy"/>Copy selected</button></div></section></div></main>;
}

function Toggle({ defaultOn = true, label }: { defaultOn?: boolean; label: string }) {
  const [on, setOn] = useState(defaultOn);
  return <button type="button" role="switch" aria-label={label} aria-checked={on} onClick={() => setOn(!on)} className={`demo-toggle ${on ? 'on' : ''}`}><i/></button>;
}

function SaasSettings() {
  return <main className="a-settings"><div className="a-settings-head"><span>WORKSPACE SETTINGS</span><h1>Settings</h1><p>Manage how Opera works for you.</p></div><div className="a-settings-layout"><nav><button className="active"><Icon name="sliders"/>General</button><button><Icon name="wand"/>AI & models</button><button><Icon name="palette"/>Appearance</button><button><Icon name="shield"/>Privacy & data</button></nav><section><div className="a-setting-block"><header><h2>General</h2><p>Your default creation preferences.</p></header><label><span><b>Default creation flow</b><small>Choose what opens when you create new work.</small></span><select defaultValue="adapter"><option value="adapter">Adapt to Xiaohongshu</option><option>Write Xiaohongshu</option><option>Write WeChat article</option></select></label><label><span><b>Default output length</b><small>Can be changed for each creation.</small></span><select defaultValue="standard"><option value="standard">Standard · 600–900</option><option>Short · 300–500</option><option>Long · 1000+</option></select></label></div><div className="a-setting-block"><header><h2>Workspace</h2><p>Local behavior and interface preferences.</p></header><label><span><b>Autosave local drafts</b><small>Save edits in this browser as you type.</small></span><Toggle label="自动保存本地草稿"/></label><label><span><b>Quality checks</b><small>Show length, structure and factual-review reminders.</small></span><Toggle label="质量检查"/></label><label><span><b>Export watermark</b><small>Add Opera attribution to exported slide cards.</small></span><Toggle label="导出水印" defaultOn={false}/></label></div><button className="a-save">Save changes</button></section></div></main>;
}

function AiConcept({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  if (screen === 'login') return <AiLogin onEnter={() => onNavigate('dashboard')}/>;
  return <div className="b-shell"><AiSidebar screen={screen} onNavigate={onNavigate}/><div className="b-content">{screen === 'dashboard' && <AiDashboard onNavigate={onNavigate}/>} {screen === 'workspace' && <AiWorkspace/>} {screen === 'settings' && <AiSettings/>}</div></div>;
}

function AiLogin({ onEnter }: { onEnter: () => void }) {
  return <div className="b-login"><span className="b-login-glow b-glow-one"/><span className="b-login-glow b-glow-two"/><header><OperaMark/><span>Thoughtful creation, with AI.</span></header><main><div className="b-login-symbol"><Icon name="sparkle" size={27}/></div><span>MEET YOUR CREATIVE AGENT</span><h1>What would you like<br/>to make today?</h1><p>Opera helps you think, draft, adapt and refine — while keeping every decision in your hands.</p><button className="b-login-main" onClick={onEnter}>Start creating <Icon name="arrow"/></button><button className="b-login-alt"><b>G</b> Continue with Google</button><small>概念登录页 · 当前版本仍支持免登录本地使用</small></main><footer><span>Local-first drafts</span><span>Human-approved outputs</span><span>No auto-publishing</span></footer></div>;
}

function AiSidebar({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  return <aside className="b-sidebar"><div className="b-logo"><OperaMark/><button><Icon name="panel"/></button></div><button className="b-new" onClick={() => onNavigate('dashboard')}><Icon name="edit"/>Start a creation</button><nav><button className={screen === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}><Icon name="sparkle"/>New conversation</button><button><Icon name="search"/>Search</button><span>RECENT WORK</span>{['AI 时代的稀缺能力','三年自由职业复盘','停止无效努力','内容复利系统'].map((item,index) => <button key={item} className={screen === 'workspace' && index === 0 ? 'active' : ''} onClick={() => index === 0 && onNavigate('workspace')}><Icon name="message"/><span>{item}</span></button>)}</nav><div className="b-agent-status"><i><Icon name="sparkle" size={13}/></i><span><b>Opera Agent</b><small>Ready · Claude Sonnet</small></span><em/></div><button className={`b-settings-link ${screen === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}><Icon name="settings"/>Settings</button><div className="b-user"><i>云</i><span><b>云林</b><small>Local workspace</small></span><Icon name="more"/></div></aside>;
}

function AiDashboard({ onNavigate }: { onNavigate: (view: LabView) => void }) {
  const [prompt, setPrompt] = useState('');
  return <main className="b-dashboard"><header><div className="b-mobile-logo"><OperaMark/></div><button><Icon name="sliders"/>Sonnet 4.6 <span>⌄</span></button><div><button><Icon name="clock"/>Activity</button><i>云</i></div></header><section className="b-welcome"><div className="b-orb"><span/><Icon name="sparkle" size={24}/></div><span>GOOD MORNING, 云林</span><h1>What will we create today?</h1><p>Bring an idea, a rough draft, or a finished article. I’ll help you find the clearest path forward.</p><div className="b-composer"><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Tell Opera what you want to create…"/><footer><div><button><Icon name="plus"/>Add source</button><button><Icon name="sliders"/>Set direction</button></div><button className={prompt ? 'ready' : ''} onClick={() => onNavigate('workspace')}><Icon name="send"/></button></footer></div><div className="b-suggestions"><button onClick={() => onNavigate('workspace')}><i><Icon name="wand"/></i><span><b>Adapt an article</b><small>Turn a long-form piece into a Xiaohongshu package</small></span><em>→</em></button><button onClick={() => onNavigate('workspace')}><i><Icon name="edit"/></i><span><b>Write from an idea</b><small>Shape a topic into a complete social post</small></span><em>→</em></button><button onClick={() => onNavigate('workspace')}><i><Icon name="file"/></i><span><b>Develop a long-form draft</b><small>Create a structured WeChat article together</small></span><em>→</em></button></div></section><section className="b-resume"><header><div><span>CONTINUE YOUR WORK</span><h2>Pick up where you left off</h2></div><button>View all</button></header><div><button onClick={() => onNavigate('workspace')}><span className="b-work-thumb"><i>01</i><b>AI 时代，最稀缺的<br/>不是努力</b></span><span><em>READY TO REVIEW</em><b>AI 时代的稀缺能力</b><small>Article adaptation · 8 minutes ago</small></span><Icon name="arrow"/></button><button><span className="b-work-thumb second"><i>长文</i><b>自由职业三年<br/>我重新理解效率</b></span><span><em className="draft">DRAFT</em><b>三年自由职业复盘</b><small>WeChat article · Yesterday</small></span><Icon name="arrow"/></button></div></section></main>;
}

function AiWorkspace() {
  const [confirmed, setConfirmed] = useState(false);
  return <main className="b-workspace"><header><div><button><Icon name="panel"/></button><span><b>AI 时代的稀缺能力</b><small>Article adaptation</small></span></div><div><span><i/>Saved locally</span><button><Icon name="more"/></button><i className="b-header-user">云</i></div></header><div className="b-work-grid"><section className="b-conversation"><div className="b-chat-intro"><span>TODAY · 10:38</span></div><div className="b-user-message"><span>云</span><p>把这篇公众号文章改写成一套小红书内容。面向正在使用 AI 的知识工作者，语气清晰、有洞察，但不要制造焦虑。</p></div><div className="b-agent-message"><i><Icon name="sparkle"/></i><div><span>OPERA</span><p>我会先理解原文，再和你确认最值得保留的观点。确认后，我会生成标题、6 张文字卡片、正文和标签。</p><div className="b-process"><div className="done"><Icon name="check"/><span><b>Read source article</b><small>1,842 characters · 12 paragraphs</small></span><em>Done</em></div><div className="done"><Icon name="check"/><span><b>Understand audience & tone</b><small>Knowledge workers · Clear, insightful</small></span><em>Done</em></div><div className={confirmed ? 'done' : 'active'}>{confirmed ? <Icon name="check"/> : <i/>}<span><b>Confirm the core ideas</b><small>{confirmed ? '4 ideas approved' : 'Waiting for your review'}</small></span><em>{confirmed ? 'Done' : 'Your turn'}</em></div><div><span className="b-process-num">4</span><span><b>Create output package</b><small>Title · Cards · Caption · Tags</small></span></div></div></div></div><div className="b-agent-message"><i><Icon name="sparkle"/></i><div><span>OPERA</span><p>这些是我从原文中识别出的 4 个核心观点。我建议用第 1 个做冲突开场，第 4 个作为行动结尾。</p><div className="b-idea-review">{['努力正在从优势变成基础设施','判断什么值得做，比完成更多更重要','好问题决定 AI 输出的上限','建立个人问题库，积累新的复利'].map((item,index) => <label key={item}><input type="checkbox" defaultChecked/><i>{index+1}</i><span><b>{item}</b><small>{['Opening tension','Core argument','Practical method','Closing action'][index]}</small></span><Icon name="more"/></label>)}<footer><button><Icon name="plus"/>Add an idea</button><button onClick={() => setConfirmed(true)}>{confirmed ? <><Icon name="check"/> Confirmed</> : <>Confirm these ideas <Icon name="arrow"/></>}</button></footer></div></div></div><div className="b-chat-box"><textarea placeholder="Ask Opera to adjust the direction…"/><footer><button><Icon name="plus"/></button><span>Opera can make mistakes. Review important details.</span><button><Icon name="send"/></button></footer></div></section><section className="b-artifact"><header><div><span>ARTIFACT</span><b>Output package</b></div><div><button><Icon name="eye"/>Preview</button><button><Icon name="copy"/>Copy all</button><button><Icon name="more"/></button></div></header><div className="b-artifact-body"><div className="b-artifact-meta"><span>小红书内容包</span><em>Draft · 10:42</em></div><h1>AI 时代，最稀缺的不是努力</h1><p className="b-artifact-lead">当执行变得越来越便宜，真正拉开差距的，是你能否判断什么值得做。</p><div className="b-slide-canvas"><span>01 / 06</span><small>OPENING</small><strong>你有没有发现：<br/>越努力，反而越容易<br/>陷入平庸？</strong><footer><i>OPERA</i><b>→</b></footer></div><div className="b-artifact-dots">{[1,2,3,4,5,6].map(i => <i key={i} className={i===1?'active':''}/>)}</div><div className="b-artifact-section"><span>CAPTION <b>428 字</b></span><p>过去，我们相信努力本身就是一种优势。但 AI 正在让“执行”变得前所未有地便宜……</p></div></div></section></div></main>;
}

function AiSettings() {
  return <main className="b-settings"><header><OperaMark/><div><button><Icon name="search"/>Search settings</button><i>云</i></div></header><div className="b-settings-wrap"><aside><span>SETTINGS</span><button className="active"><Icon name="sparkle"/>Your Agent</button><button><Icon name="sliders"/>Models & providers</button><button><Icon name="palette"/>Appearance</button><button><Icon name="shield"/>Privacy & data</button><button><Icon name="bell"/>Notifications</button></aside><section><div className="b-settings-title"><span>YOUR AGENT</span><h1>Shape how Opera works with you.</h1><p>These preferences guide every new conversation. You can still change direction at any time.</p></div><article className="b-agent-card"><div className="b-agent-card-head"><i><Icon name="sparkle" size={22}/></i><span><b>Opera Creative Agent</b><small>Active · Uses your preferred model</small></span><Toggle label="启用 Agent"/></div><label><span><b>How should Opera collaborate?</b><small>Choose the default balance between guidance and autonomy.</small></span><div className="b-segments"><button>Guide me</button><button className="active">Collaborate</button><button>Take initiative</button></div></label><label><span><b>Default communication style</b><small>How the Agent explains decisions and asks questions.</small></span><select defaultValue="direct"><option value="direct">Clear and concise</option><option>Exploratory</option><option>Detailed</option></select></label></article><article className="b-memory-card"><header><div><Icon name="bookmark"/><span><b>Creative memory</b><small>Let Opera remember preferences stored in this browser.</small></span></div><Toggle label="创作记忆"/></header><div className="b-memory-items"><span>Prefers clear, non-anxious language <button>×</button></span><span>Writes for knowledge workers <button>×</button></span><span>Avoids exaggerated titles <button>×</button></span><button><Icon name="plus"/>Add preference</button></div></article><div className="b-settings-actions"><span>Changes are saved locally.</span><button>Save preferences</button></div></section></div></main>;
}

function PremiumConcept({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  if (screen === 'login') return <PremiumLogin onEnter={() => onNavigate('dashboard')}/>;
  return <div className="c-shell"><PremiumRail screen={screen} onNavigate={onNavigate}/><div className="c-content">{screen === 'dashboard' && <PremiumDashboard onNavigate={onNavigate}/>} {screen === 'workspace' && <PremiumWorkspace/>} {screen === 'settings' && <PremiumSettings/>}</div></div>;
}

function PremiumLogin({ onEnter }: { onEnter: () => void }) {
  return <div className="c-login"><span className="c-aurora c-aurora-one"/><span className="c-aurora c-aurora-two"/><header><span className="c-wordmark">OPERA</span><span>PRIVATE CREATIVE STUDIO</span></header><main><span className="c-index">01 — BEGIN</span><h1>Ideas deserve<br/><em>a better stage.</em></h1><p>A private studio for transforming raw thought into work worth publishing.</p><button onClick={onEnter}>Enter your studio <span>↗</span></button><small>No account required today · Login concept for future sync</small></main><footer><span>Designed for independent minds.</span><div><i/>LOCAL FIRST <i/>HUMAN APPROVED <i/>NEVER AUTO-PUBLISHED</div></footer><span className="c-login-edition">OPERA<br/>/26</span></div>;
}

function PremiumRail({ screen, onNavigate }: { screen: DemoScreen; onNavigate: (view: LabView) => void }) {
  return <aside className="c-rail"><button className="c-rail-logo" onClick={() => onNavigate('dashboard')}>O</button><nav><button className={screen === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}><Icon name="grid"/></button><button className={screen === 'workspace' ? 'active' : ''} onClick={() => onNavigate('workspace')}><Icon name="edit"/></button><button><Icon name="layers"/></button><button><Icon name="bookmark"/></button></nav><div><button className={screen === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}><Icon name="settings"/></button><button className="c-rail-user">YL</button></div></aside>;
}

function PremiumDashboard({ onNavigate }: { onNavigate: (view: LabView) => void }) {
  return <main className="c-dashboard"><span className="c-dashboard-glow"/><header><span className="c-wordmark">OPERA / ATELIER</span><div><button><Icon name="search"/>Command</button><span>MON · 15 SEP</span></div></header><section className="c-dashboard-hero"><div><span>GOOD MORNING, YUN</span><h1>Make something<br/><em>worth keeping.</em></h1><p>Your studio is quiet. Three works are waiting for you.</p></div><button onClick={() => onNavigate('workspace')}><i><Icon name="plus" size={20}/></i><span>BEGIN A NEW WORK<small>Idea, article, or draft</small></span><b>↗</b></button></section><section className="c-bento"><article className="c-featured" onClick={() => onNavigate('workspace')}><header><span>CONTINUE / 01</span><em>READY TO REVIEW</em></header><div><small>ARTICLE ADAPTATION</small><h2>AI 时代，<br/>最稀缺的不是努力</h2><p>6 slides · 428 words · Updated 8m ago</p></div><footer><span>{[1,2,3,4,5,6].map(i => <i key={i} className={i<5?'filled':''}/>)}</span><b>Open canvas ↗</b></footer><span className="c-featured-number">01</span></article><article className="c-streak"><span>CREATIVE RHYTHM</span><strong>07</strong><em>DAY STREAK</em><div>{['M','T','W','T','F','S','S'].map((day,i)=><i key={`${day}-${i}`} className={i<5?'active':''}>{day}</i>)}</div><p>Keep the signal alive.</p></article><article className="c-works"><header><span>RECENT WORKS</span><button>VIEW ALL ↗</button></header>{[['02','自由职业三年，我重新理解效率','WECHAT · EDITING'],['03','停止无效努力的 5 个信号','XHS · DRAFT'],['04','知识博主的内容复利系统','ADAPT · REVIEW']].map(row => <button key={row[0]}><i>{row[0]}</i><span><b>{row[1]}</b><small>{row[2]}</small></span><em>↗</em></button>)}</article><article className="c-manifesto"><Icon name="sparkle" size={20}/><blockquote>“The work is yours.<br/>AI only clears the way.”</blockquote><span>OPERA PRINCIPLE / 01</span></article></section></main>;
}

function PremiumWorkspace() {
  const [mode, setMode] = useState<'canvas'|'focus'>('canvas');
  return <main className={`c-workspace ${mode === 'focus' ? 'focus' : ''}`}><span className="c-work-glow"/><header><div><span className="c-wordmark">OPERA</span><i/> <span>AI 时代的稀缺能力</span></div><div><span>SAVED / 10:42</span><button onClick={() => setMode(mode === 'canvas' ? 'focus' : 'canvas')}><Icon name="eye"/>{mode === 'canvas' ? 'Focus' : 'Canvas'}</button><button className="c-export">EXPORT ↗</button></div></header><div className="c-command-dock"><button className="active"><Icon name="edit"/><span>Canvas</span></button><button><Icon name="sparkle"/><span>Agent</span></button><button><Icon name="layers"/><span>Versions</span></button><i/><button><Icon name="command"/><span>⌘ K</span></button></div><section className="c-canvas"><aside className="c-outline"><span>COMPOSITION</span><button className="active"><i>01</i><span><b>Opening</b><small>Cover + hook</small></span></button><button><i>02</i><span><b>Core tension</b><small>2 slides</small></span></button><button><i>03</i><span><b>Framework</b><small>2 slides</small></span></button><button><i>04</i><span><b>Closing</b><small>1 slide</small></span></button><footer><span>6 SLIDES</span><span>428 WORDS</span></footer></aside><article className="c-artboard"><header><span>SLIDE 01 / OPENING</span><div><button><Icon name="copy"/></button><button><Icon name="more"/></button></div></header><div className="c-slide"><span>01</span><div><small>THE NEW SCARCITY</small><h1>AI 时代，<br/>最稀缺的<br/><em>不是努力</em></h1><p>当执行变得越来越便宜，<br/>真正拉开差距的，是判断。</p></div><footer><b>OPERA / NOTES</b><span>SWIPE TO READ <i>→</i></span></footer></div><div className="c-slide-strip">{[1,2,3,4,5,6].map(i => <button key={i} className={i===1?'active':''}><span>{i}</span><i/></button>)}</div></article><aside className="c-inspector"><header><span>INSPECTOR</span><button><Icon name="sliders"/></button></header><section><span>AI DIRECTION</span><div className="c-agent-mini"><i><Icon name="sparkle"/></i><p>Opening is clear and restrained. The contrast lands without creating anxiety.</p></div><button>Ask Opera to refine ↗</button></section><section><span>TYPOGRAPHY</span><label><small>Style</small><button>Editorial Serif <em>⌄</em></button></label><label><small>Scale</small><div><button>−</button><b>64</b><button>+</button></div></label></section><section><span>ATMOSPHERE</span><div className="c-swatches">{['#d6ff66','#8b5cf6','#f6f3ff','#ff735c'].map((color,i)=><button key={color} className={i===0?'active':''} style={{background:color}}/>)}</div></section></aside></section></main>;
}

function PremiumSettings() {
  return <main className="c-settings"><span className="c-settings-glow"/><header><span className="c-wordmark">OPERA / PREFERENCES</span><div><button><Icon name="command"/> COMMAND</button><i>YL</i></div></header><div className="c-settings-grid"><aside><span>STUDIO SETTINGS</span><h1>Make it<br/><em>your space.</em></h1><nav><button className="active">01 <span>Studio</span></button><button>02 <span>Intelligence</span></button><button>03 <span>Appearance</span></button><button>04 <span>Privacy</span></button></nav><p>Preferences are stored locally in this browser.</p></aside><section><article><header><div><span>01 / STUDIO</span><h2>Creative defaults</h2></div><Icon name="sliders"/></header><label><span><b>Opening ritual</b><small>Choose the first view when Opera begins.</small></span><div className="c-choice"><button>Last work</button><button className="active">New canvas</button><button>Overview</button></div></label><label><span><b>Default medium</b><small>Your most frequent kind of work.</small></span><button className="c-select">Xiaohongshu adaptation <em>⌄</em></button></label><label><span><b>Quiet autosave</b><small>Preserve every edit locally, without interruption.</small></span><Toggle label="静默自动保存"/></label></article><article><header><div><span>02 / ATMOSPHERE</span><h2>Interface character</h2></div><Icon name="palette"/></header><div className="c-theme-cards"><button className="active"><i className="theme-noir"/><span><b>Noir</b><small>Focused & cinematic</small></span></button><button><i className="theme-paper"/><span><b>Paper</b><small>Warm & editorial</small></span></button><button><i className="theme-system"/><span><b>System</b><small>Follow your device</small></span></button></div></article><footer><span>LAST SAVED / 10:42</span><button>SAVE PREFERENCES ↗</button></footer></section></div></main>;
}
