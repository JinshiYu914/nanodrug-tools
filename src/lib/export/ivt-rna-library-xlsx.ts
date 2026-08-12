import * as XLSX from "xlsx-js-style";
import {
  formatReactionAmount,
  linearizationDnaVolumeUl,
  linearizationOneXAmount,
  scaledComponentAmount,
  type DigestionComponent,
  type DigestionSystemSnapshot,
  type RnaLibraryEntry,
} from "@/lib/calculations/ivt-experiment";

type Cell = string | number;
const safe = (value: number | null): Cell => (value === null ? "" : value);

function systemText(
  components: DigestionComponent[],
  reactionCount = "1",
  scaled = false
): string {
  return components
    .map((component) => {
      const amount = scaled
        ? scaledComponentAmount(component.amount, reactionCount)
        : component.amount;
      return [
        component.name,
        component.stockConcentration,
        amount
          ? `${component.fillTo ? "to " : ""}${amount} ${component.unit}`
          : "",
      ]
        .filter(Boolean)
        .join(" / ");
    })
    .filter(Boolean)
    .join("；");
}

function linearizationSystemText(
  system: DigestionSystemSnapshot | null,
  concentrationNgUl: string,
  massUg: string,
  totalVolumeUl: string,
  scaled = false
): string {
  if (!system) return "";
  return system.components
    .map((component) => {
      const one = formatReactionAmount(
        linearizationOneXAmount(
          component,
          system,
          concentrationNgUl,
          massUg,
          totalVolumeUl
        )
      );
      const amount = scaled
        ? scaledComponentAmount(one, system.reactionCount)
        : one;
      return amount ? `${component.name} / ${amount} µL` : component.name;
    })
    .join("；");
}

export function exportRnaLibraryXlsx(entries: RnaLibraryEntry[]): void {
  const rows: Cell[][] = [
    [
      "样本序号",
      "RNA",
      "T7质粒载体",
      "来源批次",
      "批次编号",
      "批次日期",
      "酶切位点",
      "内切酶品牌",
      "DNA 浓度 (ng/µL)",
      "DNA 质量 (µg)",
      "DNA 自动体积 (µL)",
      "线性化单体系总体积 (µL)",
      "酶切反应数 n",
      "酶切体系 (1×)",
      "酶切体系 (n×)",
      "酶切温度 (℃)",
      "酶切时间 (h)",
      "回收试剂盒",
      "回收得率 (%)",
      "IVT 体系 (µL)",
      "IVT 反应数 n",
      "IVT 加样体系 (1×)",
      "IVT 加样体系 (n×)",
      "IVT 试剂盒",
      "核苷修饰",
      "Cap 加帽",
      "RNA 纯化方法",
      "RNA 纯化试剂盒",
      "浓度 (µg/µL)",
      "终体积 (µL)",
      "RNA 总得量 (µg)",
      "表达验证",
    ],
    ...entries.map((entry) => [
      entry.rna.name,
      entry.rna.rnaType,
      entry.rna.vector,
      entry.batchName,
      entry.batchCode,
      entry.batchDate,
      entry.rna.linearization.restrictionSite,
      entry.rna.linearization.enzymeBrand,
      entry.rna.linearization.dnaConcentrationNgUl,
      entry.rna.linearization.dnaMassUg,
      linearizationDnaVolumeUl(
        entry.rna.linearization.dnaConcentrationNgUl,
        entry.rna.linearization.dnaMassUg
      ) ?? "",
      entry.rna.linearization.totalVolumeUl,
      entry.rna.linearization.digestionSystem?.reactionCount ?? "1",
      linearizationSystemText(
        entry.rna.linearization.digestionSystem,
        entry.rna.linearization.dnaConcentrationNgUl,
        entry.rna.linearization.dnaMassUg,
        entry.rna.linearization.totalVolumeUl
      ),
      linearizationSystemText(
        entry.rna.linearization.digestionSystem,
        entry.rna.linearization.dnaConcentrationNgUl,
        entry.rna.linearization.dnaMassUg,
        entry.rna.linearization.totalVolumeUl,
        true
      ),
      entry.rna.linearization.temperatureC,
      entry.rna.linearization.durationH,
      entry.rna.linearization.recoveryKitBrand,
      entry.rna.linearization.recoveryYieldPercent,
      entry.rna.ivt.reactionVolumeUl,
      entry.rna.ivt.reactionSystem.reactionCount,
      systemText(entry.rna.ivt.reactionSystem.components),
      systemText(
        entry.rna.ivt.reactionSystem.components,
        entry.rna.ivt.reactionSystem.reactionCount,
        true
      ),
      entry.rna.ivt.kitBrand,
      entry.rna.ivt.modification,
      entry.rna.ivt.cap,
      entry.rna.purification.method,
      entry.rna.purification.kitBrand,
      entry.rna.purification.concentrationUgUl,
      entry.rna.purification.finalVolumeUl,
      safe(entry.totalMassUg),
      entry.rna.expressionValidation,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map((_, column) => ({
    wch: Math.min(
      42,
      Math.max(10, ...rows.map((row) => String(row[column] ?? "").length + 2))
    ),
  }));
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "RNA库");
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `ivt-rna-library-${stamp}.xlsx`);
}
