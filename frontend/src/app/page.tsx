import Link from "next/link";
import {
  BookOpen,
  Bot,
  FileText,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Data Aggregation",
    desc: "统一采集多平台个人数据 -- 书影音、日记、想法，一处汇聚。",
  },
  {
    icon: Bot,
    title: "AI Chat",
    desc: "基于个人数据与 AI 自由对话，获取洞察、回答和推荐。",
  },
  {
    icon: FileText,
    title: "Auto Reports",
    desc: "周报、月报、年报自动生成，支持 Markdown / PDF / Web 导出。",
  },
  {
    icon: TrendingUp,
    title: "Visualization",
    desc: "阅读趋势、评分分布、标签云、时间线看板，一目了然。",
  },
];

const phases = [
  {
    label: "Phase 1 - Current",
    title: "Data Collection",
    current: true,
    items: [
      "Douban full data scraping",
      "WeRead integration",
      "Flomo integration",
      "Unified data model & storage",
    ],
  },
  {
    label: "Phase 2",
    title: "AI Agent",
    current: false,
    items: [
      "AI chat interface (personal data context)",
      "Reading preference analysis & recommendations",
      "Smart tagging & categorization",
      "Cross-platform data correlation",
    ],
  },
  {
    label: "Phase 3",
    title: "Auto Reports",
    current: false,
    items: [
      "Weekly / Monthly / Yearly auto generation",
      "Markdown / PDF / Web export",
      "Custom report templates",
    ],
  },
  {
    label: "Phase 4",
    title: "Dashboard",
    current: false,
    items: [
      "Personal info dashboard",
      "Reading trend charts (monthly / yearly)",
      "Rating distribution",
      "Tag cloud & category stats",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0c1222] dark:text-slate-200">
      {/* Nav */}
      <nav className="fixed top-0 z-100 w-full border-b border-sky-100 bg-white/85 backdrop-blur-xl dark:border-slate-700/50 dark:bg-[#0c1222]/85">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-sky-700 dark:text-sky-400">
            LifeInk AI
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              Core
            </a>
            <a href="#sources" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              Data Sources
            </a>
            <a href="#roadmap" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              Roadmap
            </a>
            <Link href="/workspace" className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
              Try It
            </Link>
            <a
              href="https://github.com/amlei/lifeink"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 transition-colors hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-100 via-white to-sky-50 px-6 pb-16 pt-24 text-center dark:from-slate-900 dark:via-[#0c1222] dark:to-slate-900">
        <h1 className="text-5xl font-exabold tracking-tight text-sky-800 dark:text-sky-300 sm:text-6xl">
          LifeInk AI
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-500 dark:text-slate-400">
          Personal AI Agent - 聚合书影音日记，用 AI 重新理解你的生活。
        </p>
        <p className="mt-3 max-w-lg text-[0.95rem] text-slate-500 dark:text-slate-400">
          从豆瓣、微信读书、Flomo 等平台采集个人数据，通过 AI 对话分析、偏好洞察，自动生成周报/月报/年度总结。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/workspace"
            className="rounded-lg bg-sky-500 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
          >
            Try It Out
          </Link>
          <a
            href="https://github.com/amlei/lifeink"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border-2 border-sky-300 px-8 py-3 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-900/30"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-sky-800 dark:text-sky-300">
          Core
        </h2>
        <p className="mt-2 mb-10 text-slate-500 dark:text-slate-400">
          四大核心能力，让生活记录变成可理解的数据。
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-sky-100 bg-sky-50 p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-200/40 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:shadow-sky-900/20"
            >
              <Icon className="mb-3 size-8 text-sky-500 dark:text-sky-400" />
              <h3 className="mb-1 text-base font-semibold text-sky-800 dark:text-sky-300">
                {title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section id="sources" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-sky-800 dark:text-sky-300">
          Data Sources
        </h2>
        <p className="mt-2 mb-10 text-slate-500 dark:text-slate-400">
          支持多平台数据接入，持续扩展中。
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-sky-200 px-5 py-2 text-sm font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
            Douban (Books / Movies / Games / Reviews / Notes)
          </span>
          <span className="rounded-full bg-sky-200 px-5 py-2 text-sm font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
            Notion Sync
          </span>
          <span className="rounded-full bg-sky-100 px-5 py-2 text-sm font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
            WeRead
          </span>
          <span className="rounded-full bg-sky-100 px-5 py-2 text-sm font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
            Flomo
          </span>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-sky-800 dark:text-sky-300">
          Roadmap
        </h2>
        <p className="mt-2 mb-10 text-slate-500 dark:text-slate-400">
          从数据采集到 AI 驱动的个人洞察平台。
        </p>
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-0 top-0 h-full w-0.5 bg-sky-200 dark:bg-slate-700" />

          {phases.map((phase) => (
            <div key={phase.label} className="relative mb-8 last:mb-0">
              {/* Dot */}
              <div
                className={`absolute -left-8 top-1.5 size-3 rounded-full border-2 border-white shadow-[0_0_0_2px_var(--tw-shadow-color)] dark:border-[#0c1222] ${
                  phase.current
                    ? "bg-sky-500 shadow-sky-300 dark:shadow-sky-700"
                    : "bg-sky-400 shadow-sky-200 dark:shadow-slate-600"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-500 dark:text-sky-400">
                {phase.label}
              </span>
              <h3 className="mt-0.5 text-base font-semibold text-sky-800 dark:text-sky-300">
                {phase.title}
              </h3>
              <ul className="mt-1.5 list-disc pl-5 text-sm text-slate-500 dark:text-slate-400">
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sky-100 bg-sky-50 py-10 text-center text-sm text-slate-500 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-400">
        <p>
          LifeInk AI &mdash;{" "}
          <a
            href="https://github.com/amlei/lifeink"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:underline dark:text-sky-400"
          >
            github.com/amlei/lifeink
          </a>
        </p>
      </footer>
    </div>
  );
}
