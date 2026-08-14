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
  findProtein,
  linkerNmolPerUgRna,
  proteinName,
  systemName,
} from "@/lib/calculations/tlnp-conjugation";
import { describeParams } from "@/lib/calculations/tlnp-params";
import { liverSpleenRatio } from "@/lib/calculations/tlnp-roi";
import {
  INVITRO_READOUT_LABELS,
  invitroUnitLabel,
  resolveEe,
  summarizeBatch,
  summarizeInVitro,
  TEM_LABELS,
  type AssayDesign,
  type DlsResult,
  type EeResult,
  type TemFlag,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { CHROMATOGRAM_AXIS_LABELS } from "@/lib/calculations/chromatogram";

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
    ["LNP 制备日期", d.prep.design.date],
    ["偶联反应日期", d.conjugation.design.date],
    ["LNP 纯化日期", d.purification.design.date],
    ["体外实验日期", d.assay.invitro.design.date],
    ["体内实验日期", d.assay.invivo.design.date],
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
    ["抗体数", s.proteinCount],
    ["反应体系数", s.systemCount],
    ["平均粒径 (nm)", n2(s.meanSize_nm)],
    ["平均 PDI", n2(s.meanPdi)],
    ["平均包封率 (%)", n2(s.meanEe_percent)],
    ["平均得率 (%)", n2(s.meanYield_percent)],
  ];
}

interface CharacterizationEntry {
  name: string;
  ee: EeResult;
  dls: DlsResult;
  tem: TemFlag;
  note: string;
}

/** Shared by 表征结果 and 纯化后表征 — the same measurements, twice. */
function characterizationRows(
  entries: CharacterizationEntry[],
  subjectLabel: string
): Cell[][] {
  const head: Cell[] = [
    subjectLabel,
    "浓度 (ng/µL)",
    "体积 (µL)",
    "包封率 (%)",
    "得率 (%)",
    "粒径 (nm)",
    "PDI",
    "Zeta (mV)",
    "TEM",
    "数据来源",
    "备注",
  ];
  const body = entries.map((e) => {
    const ee = resolveEe(e.ee);
    return [
      e.name,
      n2(ee.conc),
      n2(ee.volume),
      n2(ee.ee),
      n2(ee.yield_),
      e.dls.size_nm,
      e.dls.pdi,
      e.dls.zeta_mV,
      e.tem === "" ? "" : TEM_LABELS[e.tem],
      ee.source === "ribogreen"
        ? `RiboGreen: ${e.ee.link?.itemName ?? ""}`
        : ee.source === "manual"
          ? "手动录入"
          : "",
      e.note,
    ] as Cell[];
  });
  return [head, ...body];
}

function prepCharacterization(d: TlnpExperimentData): Cell[][] {
  return characterizationRows(
    d.prep.samples.map((s, i) => ({
      name: s.name || `样品 ${i + 1}`,
      ee: s.ee,
      dls: s.dls,
      tem: s.tem,
      note: s.resultNote,
    })),
    "样品"
  );
}

function purifiedCharacterization(d: TlnpExperimentData): Cell[][] {
  return characterizationRows(
    d.conjugation.systems.map((sys, i) => {
      const r = d.purification.results.systems.find(
        (x) => x.systemId === sys.id
      );
      return {
        name: systemName(sys, i),
        ee: r?.ee ?? { link: null, manual: { conc_ng_uL: "", volume_uL: "", ee_percent: "", yield_percent: "" } },
        dls: r?.dls ?? { size_nm: "", pdi: "", zeta_mV: "", instrument: "", note: "" },
        tem: r?.tem ?? "",
        note: r?.note ?? "",
      };
    }),
    "反应体系"
  );
}

function proteinRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = [
    "抗体",
    "来源",
    "表达载体",
    "表达日期",
    "分子量 (Da)",
    "浓度",
    "单位",
    "备注",
  ];
  const body = d.conjugation.proteins.map((p, i) => [
    proteinName(p, i),
    p.source,
    p.expressionSystem,
    p.expressionDate,
    p.mw,
    p.conc,
    p.concUnit === "uM" ? "µM" : "mg/mL",
    p.note,
  ] as Cell[]);
  return [head, ...body];
}

/** One row per reaction system: the design, the dose and how it looked. */
function systemRows(d: TlnpExperimentData): Cell[][] {
  const head: Cell[] = [
    "反应体系",
    "LNP 来源",
    "LNP 浓度 (ng/µL)",
    "投料 LNP-RNA (µg)",
    "linker (mol %)",
    "linker (nmol/µg RNA)",
    "抗体",
    "linker:抗体",
    "LNP 取用 (µL)",
    "linker (nmol)",
    "抗体 (nmol)",
    "抗体取用 (µL)",
    "反应 buffer (µL)",
    "总体积 (µL)",
    "反应 buffer",
    "温度",
    "时间",
    "摇床",
    "浑浊度",
    "沉淀",
    "观测备注",
    "备注",
  ];
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
  const body = d.conjugation.systems.map((s, i) => {
    const protein = findProtein(d.conjugation.proteins, s.proteinId);
    const dose = computeConjugationDose(s, protein);
    const obs = d.conjugation.results.observations.find(
      (o) => o.systemId === s.id
    );
    const sample = d.prep.samples.find((x) => x.id === s.sampleId);
    return [
      systemName(s, i),
      sample?.name ?? s.lnpName,
      s.lnpConc,
      s.rnaMass,
      s.linkerPercent,
      n2(linkerNmolPerUgRna(s.basis, s.linkerPercent)),
      proteinName(protein),
      s.molarRatio ? `1:${s.molarRatio}` : "",
      n2(dose.lnpVolume_uL),
      n2(dose.linker_nmol),
      n2(dose.protein_nmol),
      n2(dose.proteinVolume_uL),
      n2(dose.bufferVolume_uL),
      n2(dose.totalVolume_uL),
      s.reactionBuffer,
      s.temperature,
      s.duration,
      s.shaking,
      turbidity[obs?.turbidity ?? ""] ?? "",
      precipitate[obs?.precipitate ?? ""] ?? "",
      obs?.note ?? "",
      s.note,
    ] as Cell[];
  });
  return [head, ...body];
}

function purificationRows(d: TlnpExperimentData): Cell[][] {
  const g = d.purification.design;
  const rows: Cell[][] = [
    ["纯化日期", g.date],
    ["纯化方式", g.method === "" ? "" : g.method],
    ["操作人", g.operator],
  ];
  if (g.method === "cl4b") {
    rows.push(
      ["柱长 (cm)", g.cl4b.columnLength],
      ["柱径 (cm)", g.cl4b.columnDiameter],
      ["流速 (mL/min)", g.cl4b.flowRate],
      ["洗脱 buffer", g.cl4b.buffer],
      ["超滤浓缩", g.cl4b.ultrafiltrationConcentrate ? "是" : "否"]
    );
  } else if (g.method === "ultrafiltration") {
    rows.push(
      ["截留分子量 (kDa)", g.ultrafiltration.mwco],
      ["次数", g.ultrafiltration.cycles],
      ["备注", g.ultrafiltration.note]
    );
  } else if (g.method === "dialysis") {
    rows.push(
      ["截留分子量 (kDa)", g.dialysis.mwco],
      ["时长", g.dialysis.duration],
      ["buffer", g.dialysis.buffer]
    );
  }
  return rows;
}

function chromatogramRows(d: TlnpExperimentData): Cell[][] {
  const out: Cell[][] = [];
  for (const c of d.purification.chromatograms) {
    out.push([c.name, c.note]);
    out.push([CHROMATOGRAM_AXIS_LABELS[c.xAxis], ...c.channels.map((ch) => ch.label)]);
    for (const p of c.points) {
      out.push([p.x, ...p.y.map((v) => (v === null ? "" : v))]);
    }
    if (c.fractionMarks.length > 0) {
      out.push([]);
      out.push(["Fraction Mark", CHROMATOGRAM_AXIS_LABELS[c.xAxis]]);
      for (const mark of c.fractionMarks) {
        out.push([mark.label, mark.positions[c.xAxis] ?? ""]);
      }
    }
    out.push([]);
  }
  return out.length > 0 ? out : [["（没有导入层析数据）"]];
}

/** 设计参数 for one arm, one row per pickable field. */
function assayDesignRows(label: string, design: AssayDesign): Cell[][] {
  const rows: Cell[][] = [[`${label}实验设计`, ""], ["日期", design.date]];
  for (const e of design.params) rows.push([e.label, e.value]);
  if (design.note.trim()) rows.push(["设计备注", design.note]);
  return rows;
}

/**
 * 体外: the replicate matrix as pasted, plus the mean ± SD under it.
 *
 * Both, because the matrix is the raw record and the summary is what gets
 * quoted — recomputing a mean from a spreadsheet is where transcription errors
 * come from.
 */
function invitroRows(d: TlnpExperimentData): Cell[][] {
  const r = d.assay.invitro.results;
  const rows: Cell[][] = assayDesignRows("体外", d.assay.invitro.design);
  rows.push([]);
  if (r.columns.length === 0) return [...rows, ["（还没有体外结果）"]];

  const unit = invitroUnitLabel(r);
  const names = r.columns.map((c, i) => c.name || `样本 ${i + 1}`);
  rows.push([`检测指标：${INVITRO_READOUT_LABELS[r.readout]}`, `单位：${unit}`]);
  rows.push(["重复", ...names]);
  r.replicates.forEach((rep, i) => {
    rows.push([`#${i + 1}`, ...r.columns.map((_, k) => rep.values[k] ?? "")]);
  });

  const stats = summarizeInVitro(r);
  rows.push([]);
  rows.push(["均值", ...stats.map((s) => n2(s.mean))]);
  rows.push(["SD", ...stats.map((s) => n2(s.sd))]);
  rows.push(["n", ...stats.map((s) => s.values.length)]);
  return rows;
}

/**
 * 体内: one block per imaging run — its ROI rows, then the liver/spleen share
 * the third chart draws.
 *
 * Runs stay separate rather than being concatenated: 6 h and 24 h are different
 * figures, and pooling them would put two samples of the same name in one
 * table with no way to tell which imaging session each came from.
 */
function invivoRows(d: TlnpExperimentData): Cell[][] {
  const r = d.assay.invivo.results;
  const rows: Cell[][] = assayDesignRows("体内", d.assay.invivo.design);
  rows.push([]);
  if (r.runs.length === 0) return [...rows, ["（还没有体内结果）"]];

  r.runs.forEach((run, i) => {
    rows.push([run.name || `成像结果 ${i + 1}`, run.note]);
    if (run.rows.length === 0) {
      rows.push(["（这组还没有数据）"], []);
      return;
    }
    rows.push([
      "样本",
      "器官",
      "Total ROI — Total Flux (p/s)",
      "Avg ROI — Avg Radiance (p/s/cm²/sr)",
    ]);
    for (const row of run.rows) {
      rows.push([row.sample, row.organ, row.totalRoi, row.avgRoi]);
    }

    const ratio = liverSpleenRatio(run.rows);
    if (ratio.length > 0) {
      rows.push([]);
      rows.push(["样本", "肝占比", "脾占比", "肝/脾 (Avg ROI)"]);
      for (const b of ratio) {
        rows.push([
          b.sample,
          n2(b.liver),
          n2(b.spleen),
          isFinite(b.ratio) ? n2(b.ratio) : "",
        ]);
      }
    }
    rows.push([]);
  });
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

  XLSX.utils.book_append_sheet(wb, sheet(prepCharacterization(d)), "表征结果");
  XLSX.utils.book_append_sheet(wb, sheet(proteinRows(d)), "抗体");
  XLSX.utils.book_append_sheet(wb, sheet(systemRows(d)), "反应体系");
  XLSX.utils.book_append_sheet(wb, sheet(purificationRows(d)), "纯化方法");
  XLSX.utils.book_append_sheet(
    wb,
    sheet(purifiedCharacterization(d)),
    "纯化后表征"
  );
  XLSX.utils.book_append_sheet(wb, sheet(chromatogramRows(d)), "层析原始数据");
  XLSX.utils.book_append_sheet(wb, sheet(invitroRows(d)), "体外结果");
  XLSX.utils.book_append_sheet(wb, sheet(invivoRows(d)), "体内结果");
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
    "抗体数",
    "抗体信息",
    "反应体系数",
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
      s.proteinCount,
      data.conjugation.proteins
        .map((p, i) =>
          [proteinName(p, i), p.source, p.expressionSystem, p.expressionDate]
            .filter(Boolean)
            .join(" / ")
        )
        .join("；"),
      s.systemCount,
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
