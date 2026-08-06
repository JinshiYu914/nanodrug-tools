import * as XLSX from "xlsx-js-style";
import {
  buildBenchSheet,
  datestamp,
  formatIso,
  formatNow,
  sanitizeFilename,
} from "./lnp-bench-xlsx";
import { describeMethod } from "@/lib/calculations/lnp-bench";
import {
  computeConjugationDose,
  productName,
} from "@/lib/calculations/tlnp-conjugation";
import { describeParams } from "@/lib/calculations/tlnp-params";
import {
  resolveEe,
  summarizeBatch,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";

type Cell = string | number;

const n2 = (v: number | null): Cell =>
  v === null || !isFinite(v) ? "" : Number(v.toFixed(2));

function autoWidth(aoa: Cell[][], min = 10, max = 44): XLSX.ColInfo[] {
  const widths: number[] = [];
  for (const row of aoa) {
    row.forEach((cell, i) => {
      // CJK glyphs occupy roughly two columns at the same point size.
      const text = String(cell ?? "");
      const len = text.length + (text.match(/[一-龥]/g)?.length ?? 0);
      widths[i] = Math.max(widths[i] ?? min, Math.min(len + 2, max));
    });
  }
  return widths.map((wch) => ({ wch }));
}

function sheet(aoa: Cell[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(aoa);
  return ws;
}

function overviewRows(
  batchName: string,
  createdAt: string,
  updatedAt: string,
  d: TlnpExperimentData
): Cell[][] {
  const s = summarizeBatch(d);
  return [
    ["批次名称", batchName],
    ["批次编号", d.meta.batchCode],
    ["实验日期", d.meta.experimentDate],
    ["负责人", d.meta.operator],
    ["实验目的", d.meta.objective],
    [],
    ["创建时间", formatIso(createdAt)],
    ["最近更新", formatIso(updatedAt)],
    ["导出时间", formatNow()],
    [],
    ["阳离子脂质", s.cationicLipid],
    ["反应 linker", s.linker],
    ["Cargo", s.cargo],
    ["制备方法", s.mixing],
    ["溶剂置换", s.solventLabel],
    ["纯化方式", s.purificationLabel],
    [],
    ["样品数", s.sampleCount],
    ["反应条件数", s.conditionCount],
    ["tLNP 产物数", s.productCount],
    ["平均粒径 (nm)", n2(s.meanSize_nm)],
    ["平均 PDI", n2(s.meanPdi)],
    ["平均包封率 (%)", n2(s.meanEe_percent)],
    ["平均得率 (%)", n2(s.meanYield_percent)],
  ];
}

function characterizationRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = [
    "样品",
    "浓度 (ng/µL)",
    "体积 (µL)",
    "包封率 (%)",
    "得率 (%)",
    "粒径 (nm)",
    "PDI",
    "Zeta (mV)",
    "数据来源",
    "备注",
  ];
  const body = d.prep.samples.map((s, i) => {
    const ee = resolveEe(s.ee);
    return [
      s.name || `样品 ${i + 1}`,
      n2(ee.conc),
      n2(ee.volume),
      n2(ee.ee),
      n2(ee.yield_),
      s.dls.size_nm,
      s.dls.pdi,
      s.dls.zeta_mV,
      ee.source === "ribogreen"
        ? `RiboGreen: ${s.ee.link?.itemName ?? ""}`
        : ee.source === "manual"
          ? "手动录入"
          : "",
      s.resultNote,
    ] as Cell[];
  });
  return [head, ...body];
}

function conditionRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = [
    "条件名称",
    "linker",
    "蛋白",
    "蛋白 MW (Da)",
    "蛋白浓度",
    "摩尔比 (蛋白:LNP)",
    "LNP 取用 (µL)",
    "蛋白取用 (µL)",
    "反应总体积 (µL)",
    "温度",
    "时间",
    "摇床",
    "备注",
  ];
  const body = d.conjugation.conditions.map((c) => {
    const dose = computeConjugationDose(c);
    return [
      c.name,
      c.linker,
      c.proteinName,
      c.proteinMW,
      `${c.proteinConc} ${c.proteinConcUnit === "uM" ? "µM" : "mg/mL"}`,
      c.targetMolarRatio,
      n2(dose.lnpVolume_uL),
      n2(dose.proteinVolume_uL),
      n2(dose.totalVolume_uL),
      c.temperature,
      c.duration,
      c.shaking,
      c.note,
    ] as Cell[];
  });
  return [head, ...body];
}

/** The graph as an adjacency table — one row per 样品 → 条件 edge. */
function productRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = ["tLNP 产物", "样品", "反应条件", "浑浊度", "沉淀", "观测备注"];
  const turbidity: Record<string, string> = {
    clear: "澄清",
    slight: "微浑",
    turbid: "浑浊",
    "": "",
  };
  const precipitate: Record<string, string> = {
    none: "无沉淀",
    slight: "少量",
    heavy: "大量",
    "": "",
  };
  const body = d.conjugation.products.map((p) => {
    const sample = d.prep.samples.find((s) => s.id === p.sampleId);
    const cond = d.conjugation.conditions.find((c) => c.id === p.conditionId);
    const obs = d.conjugation.results.observations.find(
      (o) => o.productId === p.id
    );
    return [
      productName(p, sample?.name ?? "", cond?.name ?? ""),
      sample?.name ?? "",
      cond?.name ?? "",
      turbidity[obs?.turbidity ?? ""] ?? "",
      precipitate[obs?.precipitate ?? ""] ?? "",
      obs?.note ?? "",
    ] as Cell[];
  });
  return [head, ...body];
}

function chromatogramRows(d: TlnpExperimentData): Cell[][] {
  const out: Cell[][] = [];
  for (const c of d.purification.chromatograms) {
    out.push([c.name, c.sourceName, c.note]);
    out.push([c.xLabel, ...c.channels.map((ch) => ch.label)]);
    for (const p of c.points) {
      out.push([p.x, ...p.y.map((v) => (v === null ? "" : v))]);
    }
    out.push([]);
  }
  return out.length > 0 ? out : [["（没有导入层析数据）"]];
}

function assayRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = ["实验类型", "样本", "分组", "数值", "单位", "备注"];
  const rows: Cell[][] = [head];
  for (const r of d.assay.invitro.results.rows) {
    rows.push(["体外", r.label, r.group, r.value, r.unit, r.note]);
  }
  for (const r of d.assay.invivo.results.rows) {
    rows.push(["体内", r.label, r.group, r.value, r.unit, r.note]);
  }
  return rows;
}

function discussionRows(d: TlnpExperimentData): Cell[][] {
  return [
    ["模块", "记录"],
    ["LNP 制备 — 设计备注", d.prep.design.note],
    ["LNP 制备 — 结果与讨论", d.prep.results.discussion],
    ["偶联反应 — 结果与讨论", d.conjugation.results.discussion],
    ["LNP 纯化 — 设计备注", d.purification.design.note],
    ["LNP 纯化 — 结果与讨论", d.purification.results.discussion],
    ["体外实验 — 结果分析", d.assay.invitro.results.discussion],
    ["体内实验 — 结果分析", d.assay.invivo.results.discussion],
  ];
}

export function exportTlnpToXlsx(
  batchName: string,
  createdAt: string,
  updatedAt: string,
  d: TlnpExperimentData
): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheet(overviewRows(batchName, createdAt, updatedAt, d)),
    "批次概览"
  );

  // The exact worksheet the LNP calculator produces — same function, so the
  // two exports can't drift.
  if (d.prep.samples.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      buildBenchSheet(d.prep.samples),
      "配方"
    );
  }

  XLSX.utils.book_append_sheet(wb, sheet(characterizationRows(d)), "表征结果");
  XLSX.utils.book_append_sheet(wb, sheet(conditionRows(d)), "反应条件");
  XLSX.utils.book_append_sheet(wb, sheet(productRows(d)), "tLNP 产物");
  XLSX.utils.book_append_sheet(wb, sheet(chromatogramRows(d)), "层析原始数据");
  XLSX.utils.book_append_sheet(wb, sheet(assayRows(d)), "体内外结果");
  XLSX.utils.book_append_sheet(wb, sheet(discussionRows(d)), "讨论记录");

  XLSX.writeFile(
    wb,
    `${sanitizeFilename(batchName, "tlnp-batch")}-${datestamp()}.xlsx`
  );
}

// ─── Cross-batch compare ──────────────────────────────────

export interface CompareEntry {
  name: string;
  data: TlnpExperimentData;
}

export function buildCompareSheet(entries: CompareEntry[]): XLSX.WorkSheet {
  const head: Cell[] = [
    "批次",
    "批次编号",
    "日期",
    "负责人",
    "阳离子脂质",
    "linker",
    "Cargo",
    "制备方法",
    "溶剂置换",
    "纯化方式",
    "样品数",
    "条件数",
    "产物数",
    "平均粒径 (nm)",
    "平均 PDI",
    "平均包封率 (%)",
    "平均得率 (%)",
    "其他参数",
  ];
  const body = entries.map(({ name, data }) => {
    const s = summarizeBatch(data);
    return [
      name,
      data.meta.batchCode,
      data.meta.experimentDate,
      data.meta.operator,
      s.cationicLipid,
      s.linker,
      s.cargo,
      s.mixing,
      s.solventLabel || describeMethod(data.prep.design.solvent.method),
      s.purificationLabel,
      s.sampleCount,
      s.conditionCount,
      s.productCount,
      n2(s.meanSize_nm),
      n2(s.meanPdi),
      n2(s.meanEe_percent),
      n2(s.meanYield_percent),
      describeParams(
        data.prep.design.params.filter(
          (p) => !["cationicLipid", "linker", "cargo", "mixing"].includes(p.id)
        )
      ),
    ] as Cell[];
  });

  const aoa = [head, ...body];
  return sheet(aoa);
}

export function exportCompareToXlsx(entries: CompareEntry[]): void {
  if (entries.length === 0) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildCompareSheet(entries), "批次对比");
  XLSX.writeFile(wb, `tlnp-compare-${datestamp()}.xlsx`);
}
