import Link from "next/link";
import {
  BookOpen,
  Bot,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 z-100 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-primary">
            LifeInk AI
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Core
            </a>
            <a href="#sources" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Data Sources
            </a>
            <a href="#roadmap" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Roadmap
            </a>
            <Link href="/workspace" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Try It
            </Link>
            <a
              href="https://github.com/amlei/lifeink"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-muted/80 via-background to-muted/40 px-6 pb-16 pt-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          LifeInk AI
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Personal AI Agent - 聚合书影音日记，用 AI 重新理解你的生活。
        </p>
        <p className="mt-3 max-w-lg text-[0.95rem] text-muted-foreground">
          从豆瓣、微信读书、Flomo 等平台采集个人数据，通过 AI 对话分析、偏好洞察，自动生成周报/月报/年度总结。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/workspace">
              Try It Out
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href="https://github.com/amlei/lifeink"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground">
          Core
        </h2>
        <p className="mt-2 mb-10 text-muted-foreground">
          四大核心能力，让生活记录变成可理解的数据。
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="transition-transform duration-200 hover:-translate-y-1">
              <CardHeader>
                <Icon className="size-8 text-primary" />
                <CardTitle className="mt-3">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section id="sources" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground">
          Data Sources
        </h2>
        <p className="mt-2 mb-10 text-muted-foreground">
          支持多平台数据接入，持续扩展中。
        </p>
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="rounded-4xl px-4 py-1.5 text-sm">
            Douban (Books / Movies / Games / Reviews / Notes)
          </Badge>
          <Badge variant="secondary" className="rounded-4xl px-4 py-1.5 text-sm">
            Notion Sync
          </Badge>
          <Badge variant="outline" className="rounded-4xl px-4 py-1.5 text-sm">
            WeRead
          </Badge>
          <Badge variant="outline" className="rounded-4xl px-4 py-1.5 text-sm">
            Flomo
          </Badge>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="mx-auto max-w-[960px] px-6 py-20">
        <h2 className="text-3xl font-bold text-foreground">
          Roadmap
        </h2>
        <p className="mt-2 mb-10 text-muted-foreground">
          从数据采集到 AI 驱动的个人洞察平台。
        </p>
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-0 top-0 h-full w-0.5 bg-border" />

          {phases.map((phase) => (
            <div key={phase.label} className="relative mb-8 last:mb-0">
              {/* Dot */}
              <div
                className={`absolute -left-8 top-1.5 size-3 rounded-full border-2 border-background shadow-[0_0_0_2px_var(--tw-shadow-color)] ${
                  phase.current
                    ? "bg-primary shadow-primary/30"
                    : "bg-primary/50 shadow-primary/20"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {phase.label}
              </span>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">
                {phase.title}
              </h3>
              <ul className="mt-1.5 list-disc pl-5 text-sm text-muted-foreground">
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 py-10 text-center text-sm text-muted-foreground">
        <p>
          LifeInk AI &mdash;{" "}
          <a
            href="https://github.com/amlei/lifeink"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            github.com/amlei/lifeink
          </a>
        </p>
      </footer>
    </div>
  );
}
