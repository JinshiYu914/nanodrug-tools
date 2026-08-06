"use client";

import {
  ArrowRight,
  Boxes,
  Columns3,
  FileText,
  FlaskConical,
  Link2,
  Microscope,
} from "lucide-react";

export type ModuleKey = "1" | "2" | "3" | "4" | "report" | "compare";

/**
 * Each module gets a categorical pillar token — LNP is the lipid phase (amber),
 * conjugation is a process step (violet), purification runs in the aqueous
 * phase (teal), and the assays are where it meets tissue (magenta).
 *
 * The "has content" dot is `success`, a STATUS token, on purpose. Borrowing a
 * module's own pillar colour for it would make amber mean both "this is the LNP
 * step" and "this step is filled in", and both meanings would stop working.
 */
const STEPS: {
  key: ModuleKey;
  index: number;
  label: string;
  hint: string;
  icon: typeof Boxes;
  border: string;
  bg: string;
  badge: string;
  ring: string;
}[] = [
  {
    key: "1",
    index: 1,
    label: "LNP 制备",
    hint: "配方与表征",
    icon: FlaskConical,
    border: "border-pillar-lnp/40",
    bg: "bg-pillar-lnp-subtle",
    badge: "bg-pillar-lnp",
    ring: "ring-pillar-lnp",
  },
  {
    key: "2",
    index: 2,
    label: "偶联反应",
    hint: "条件与连线",
    icon: Link2,
    border: "border-accent-utility/35",
    bg: "bg-accent-utility-subtle",
    badge: "bg-accent-utility",
    ring: "ring-accent-utility",
  },
  {
    key: "3",
    index: 3,
    label: "LNP 纯化",
    hint: "层析与表征",
    icon: Columns3,
    border: "border-pillar-utr/40",
    bg: "bg-pillar-utr-subtle",
    badge: "bg-pillar-utr",
    ring: "ring-pillar-utr",
  },
  {
    key: "4",
    index: 4,
    label: "体内外实验",
    hint: "设计与结果",
    icon: Microscope,
    border: "border-pillar-disease/40",
    bg: "bg-pillar-disease-subtle",
    badge: "bg-pillar-disease",
    ring: "ring-pillar-disease",
  },
];

interface Props {
  active: ModuleKey;
  onChange: (key: ModuleKey) => void;
  /** Index 0–3 → modules 1–4. Drives the "has content" dot. */
  filled: boolean[];
}

export default function ModuleNav({ active, onChange, filled }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:gap-1.5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = active === step.key;
          return (
            <div key={step.key} className="contents">
              <button
                type="button"
                onClick={() => onChange(step.key)}
                aria-current={isActive ? "step" : undefined}
                className={`flex-1 rounded-lg border-2 p-3 text-left transition-shadow ${step.border} ${
                  isActive ? `${step.bg} ring-2 ${step.ring}` : "bg-transparent hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${step.badge}`}
                  >
                    {step.index}
                  </span>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">
                    {step.label}
                  </span>
                  {filled[i] && (
                    <span
                      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                      title="已录入内容"
                    />
                  )}
                </div>
                <p className="mt-1 ml-8 text-xs text-muted-foreground">
                  {step.hint}
                </p>
              </button>

              {i < STEPS.length - 1 && (
                <div className="hidden items-center text-muted-foreground lg:flex">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TabButton
          active={active === "report"}
          onClick={() => onChange("report")}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="总览与导出"
        />
        <TabButton
          active={active === "compare"}
          onClick={() => onChange("compare")}
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="批次对比"
        />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
