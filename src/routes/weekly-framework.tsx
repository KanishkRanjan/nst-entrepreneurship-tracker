import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Target,
  ClipboardList,
  FileCheck,
  GitBranch,
  Gauge,
  UserCog,
  Building2,
  Trophy,
  Search,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { SEMESTERS, semesterHealth, type Semester, type Week } from "@/lib/weekly-framework";
import { TpfBadge, TpfBlock } from "@/components/TpfBlock";

export const Route = createFileRoute("/weekly-framework")({
  head: () => ({
    meta: [
      { title: "Weekly Execution Framework · NST Entrepreneurship" },
      {
        name: "description",
        content:
          "Week-by-week execution architecture for Entrepreneurship Minor delivery — 32 weeks across Semesters 3 & 4.",
      },
      { property: "og:title", content: "Weekly Execution Framework — Entrepreneurship Minor" },
      {
        property: "og:description",
        content:
          "Operational playbook: topics, deliverables, mentor & TPF interventions, founder reviews, evidence and TLO/CLO mapping for every week.",
      },
    ],
  }),
  component: Page,
});

function HealthCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>
      <p className="mt-1 font-mono text-2xl tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function Chips({
  items,
  tone = "default",
}: {
  items?: string[];
  tone?: "default" | "tlo" | "clo";
}) {
  if (!items?.length) return null;
  const cls =
    tone === "tlo"
      ? "border-primary/40 bg-primary/10 text-primary"
      : tone === "clo"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
        : "border-border/60 bg-background/40 text-muted-foreground";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>
          {x}
        </span>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground/80" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {label}
        </p>
      </div>
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function WeekRow({ w }: { w: Week }) {
  const hasTpf = Boolean(w.tpf);
  return (
    <AccordionItem
      value={`w-${w.n}`}
      className="border border-border/50 rounded-lg bg-card/30 mb-2 overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex w-full items-center gap-3 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/60 font-mono text-xs">
            W{String(w.n).padStart(2, "0")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm text-foreground">{w.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {w.tlos?.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary"
                >
                  {t}
                </span>
              ))}
              {w.clos?.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300"
                >
                  {c}
                </span>
              ))}
              {hasTpf && <TpfBadge />}
              {w.event && (
                <Badge variant="outline" className="font-mono text-[9px]">
                  Event · {w.event}
                </Badge>
              )}
              {w.panel && (
                <Badge variant="outline" className="font-mono text-[9px]">
                  Panel
                </Badge>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="grid gap-4 md:grid-cols-2">
          {w.objective && (
            <Section icon={Target} label="Learning Objective">
              {w.objective}
            </Section>
          )}
          {w.outcome && (
            <Section icon={Trophy} label="Expected Outcome">
              {w.outcome}
            </Section>
          )}
          {w.topics && (
            <Section icon={Layers} label="Topics">
              <ul className="list-disc pl-4 space-y-0.5 text-sm text-foreground/85">
                {w.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Section>
          )}
          {w.activities && (
            <Section icon={ClipboardList} label="Practical Activities">
              <ul className="list-disc pl-4 space-y-0.5 text-sm text-foreground/85">
                {w.activities.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Section>
          )}
          {w.deliverables && (
            <Section icon={FileCheck} label="Deliverables">
              <ul className="list-disc pl-4 space-y-0.5 text-sm text-foreground/85">
                {w.deliverables.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Section>
          )}
          {w.evidence && (
            <Section icon={FileCheck} label="Evidence Required">
              <ul className="list-disc pl-4 space-y-0.5 text-sm text-foreground/85">
                {w.evidence.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section icon={GitBranch} label="TLO Mapping">
            <Chips items={w.tlos} tone="tlo" />
          </Section>
          <Section icon={GitBranch} label="CLO Mapping">
            <Chips items={w.clos} tone="clo" />
          </Section>
          {w.evaluation && (
            <Section icon={Gauge} label="Evaluation Method">
              {w.evaluation}
            </Section>
          )}
          {w.mentor && (
            <Section icon={UserCog} label="Mentor Involvement">
              {w.mentor}
            </Section>
          )}
          {w.industry && (
            <Section icon={Building2} label="Industry Exposure">
              {w.industry}
            </Section>
          )}
          {w.panel && (
            <Section icon={UserCog} label="Review Panel">
              {w.panel}
            </Section>
          )}
        </div>
        {hasTpf && (
          <div className="mt-4">
            <TpfBlock label="TPF Involvement">{w.tpf}</TpfBlock>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function SemesterView({ s }: { s: Semester }) {
  const h = useMemo(() => semesterHealth(s), [s]);
  const [q, setQ] = useState("");
  const weeks = s.weeks.filter((w) =>
    !q
      ? true
      : (
          w.title +
          " " +
          (w.topics?.join(" ") ?? "") +
          " " +
          (w.tlos?.join(" ") ?? "") +
          " " +
          (w.clos?.join(" ") ?? "")
        )
          .toLowerCase()
          .includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
              {s.title} · Theme
            </p>
            <h2 className="mt-1 font-mono text-lg tracking-tight text-foreground">{s.theme}</h2>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            16 weeks
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
          <HealthCard label="Weeks" value={h.weeks} icon={CalendarDays} />
          <HealthCard label="Masterclasses" value={h.masterclasses} icon={Building2} />
          <HealthCard label="Founder Reviews" value={h.founderReviews} icon={Trophy} />
          <HealthCard label="Events" value={h.events} icon={Target} />
          <HealthCard label="Deliverables" value={h.deliverables} icon={FileCheck} />
          <HealthCard label="Checkpoints" value={h.checkpoints} icon={Gauge} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search week, topic, TLO or CLO…"
          className="pl-9 font-mono text-sm"
        />
      </div>

      <Accordion type="multiple" className="space-y-0">
        {weeks.map((w) => (
          <WeekRow key={w.n} w={w} />
        ))}
      </Accordion>
    </div>
  );
}

function Page() {
  return (
    <div className="min-h-screen">
      <TopBar title="Weekly Execution Framework" breadcrumb="Master Framework" />
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/80">
            Operational Playbook
          </p>
          <h1 className="mt-1 font-mono text-2xl tracking-tight text-foreground md:text-3xl">
            Weekly Execution Framework
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Week-by-week execution architecture for Entrepreneurship Minor delivery — topics,
            deliverables, mentor & TPF interventions, founder reviews, evidence and TLO/CLO mapping.
            NST owns curriculum and evaluation; TPF touchpoints are highlighted in green.
          </p>
        </div>

        <Tabs defaultValue="S3" className="w-full">
          <TabsList className="font-mono text-xs">
            {SEMESTERS.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {SEMESTERS.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-5">
              <SemesterView s={s} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
