import * as XLSX from "xlsx-js-style";
import {
  ELISA_FIT_METHODS,
  calculateElisaSample,
  standardPointMean,
  type ElisaFit,
  type ElisaSampleRow,
  type ElisaStandardPoint,
} from "@/lib/calculations/elisa";

const thin = { style: "thin", color: { rgb: "B7C0CC" } } as const;
const border = { top: thin, bottom: thin, left: thin, right: thin };
const HEADER = "DCE6F1";
const RESULT = "E2F0D9";
const WARNING = "FFF2CC";

type Cell = XLSX.CellObject;

function cell(
  value: string | number,
  options: { bold?: boolean; fill?: string; align?: "left" | "center" | "right" } = {}
): Cell {
  return {
    t: typeof value === "number" ? "n" : "s",
    v: value,
    s: {
      font: { name: "Arial", sz: 10, bold: options.bold ?? false },
      alignment: {
        vertical: "center",
        horizontal: options.align ?? (typeof value === "number" ? "right" : "left"),
        wrapText: true,
      },
      border,
      ...(options.fill ? { fill: { fgColor: { rgb: options.fill } } } : {}),
    },
  };
}

function numericCell(value: string, fill?: string): Cell {
  const parsed = Number(value.replace(/[，,\s]/g, ""));
  const isNumeric = value.trim() !== "" && Number.isFinite(parsed);
  return {
    t: isNumeric ? "n" : "s",
    v: isNumeric ? parsed : value,
    s: {
      font: { name: "Arial", sz: 10 },
      alignment: { vertical: "center", horizontal: "right" },
      border,
      ...(fill ? { fill: { fgColor: { rgb: fill } } } : {}),
    },
  };
}

function formula(
  formulaText: string,
  cached: number | null,
  fill?: string,
  numFmt = "0.0000"
): Cell {
  return {
    t: "n",
    f: formulaText,
    v: cached ?? undefined,
    s: {
      font: { name: "Arial", sz: 10 },
      alignment: { vertical: "center", horizontal: "right" },
      border,
      numFmt,
      ...(fill ? { fill: { fgColor: { rgb: fill } } } : {}),
    },
  };
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "ELISA计算";
}

async function chartPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = 840;
  const height = 520;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.style.setProperty("color", "#667085");
  clone.style.setProperty("--border", "#D8DEE8");
  clone.style.setProperty("--muted-foreground", "#667085");
  clone.style.setProperty("--chart-1", "#F97316");
  clone.style.setProperty("--chart-2", "#0D9488");
  clone.style.setProperty("--background", "#FFFFFF");
  clone.style.setProperty("font-family", "Arial, sans-serif");

  const source = new XMLSerializer().serializeToString(clone);
  const objectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("标准曲线图片渲染失败"));
      next.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持标准曲线图片导出");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function downloadWorkbook(buffer: ArrayBuffer | Uint8Array, filename: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function measuredFormula(fit: ElisaFit, row: number): string {
  if (fit.method === "four-pl") {
    return `IFERROR('实验与拟合'!$B$15*((C${row}-'实验与拟合'!$B$13)/('实验与拟合'!$B$14-C${row}))^(1/'实验与拟合'!$B$16),"")`;
  }
  if (fit.method === "log-linear") {
    return `IFERROR(10^((C${row}-'实验与拟合'!$B$14)/'实验与拟合'!$B$13),"")`;
  }
  return `IFERROR((C${row}-'实验与拟合'!$B$14)/'实验与拟合'!$B$13,"")`;
}

export async function exportElisaToXlsx(args: {
  experimentName: string;
  experimentDate: string;
  operator: string;
  concentrationUnit: string;
  standards: ElisaStandardPoint[];
  samples: ElisaSampleRow[];
  fit: ElisaFit;
  chartSvg: SVGSVGElement;
}) {
  const { experimentName, experimentDate, operator, concentrationUnit, standards, samples, fit, chartSvg } = args;
  const methodLabel = ELISA_FIT_METHODS.find((option) => option.value === fit.method)?.label ?? fit.method;
  const metaRows: Cell[][] = [
    [cell("ELISA 实验与拟合信息", { bold: true, fill: HEADER }), cell("")],
    [cell("实验名称", { bold: true, fill: HEADER }), cell(experimentName || "未命名 ELISA 实验")],
    [cell("实验日期", { bold: true, fill: HEADER }), cell(experimentDate)],
    [cell("实验人", { bold: true, fill: HEADER }), cell(operator)],
    [cell("浓度单位", { bold: true, fill: HEADER }), cell(concentrationUnit)],
    [cell("拟合方法", { bold: true, fill: HEADER }), cell(methodLabel)],
    [cell("拟合公式", { bold: true, fill: HEADER }), cell(fit.equation)],
    [cell("R²", { bold: true, fill: HEADER }), cell(fit.valid ? fit.r2 : "--")],
    [cell("参与拟合的标准点", { bold: true, fill: HEADER }), cell(fit.n)],
    [cell("说明", { bold: true, fill: HEADER }), cell("样本终浓度 = 标曲反算浓度 × 稀释倍数；结果超出标准 OD 范围时须谨慎解释。")],
    [cell("导出来源", { bold: true, fill: HEADER }), cell("jinshiyu.xyz/elisa工具计算导出")],
    [],
  ];
  if (fit.method === "four-pl") {
    metaRows.push(
      [cell("Bottom", { bold: true, fill: HEADER }), cell(fit.parameters[0] ?? "")],
      [cell("Top", { bold: true, fill: HEADER }), cell(fit.parameters[1] ?? "")],
      [cell("EC50", { bold: true, fill: HEADER }), cell(fit.parameters[2] ?? "")],
      [cell("Hill slope", { bold: true, fill: HEADER }), cell(fit.parameters[3] ?? "")]
    );
  } else {
    metaRows.push(
      [cell("Slope", { bold: true, fill: HEADER }), cell(fit.parameters[0] ?? "")],
      [cell("Intercept", { bold: true, fill: HEADER }), cell(fit.parameters[1] ?? "")]
    );
  }

  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  metaSheet.B11.l = { Target: "https://jinshiyu.xyz/elisa", Tooltip: "打开 ELISA 计算工具" };
  metaSheet["!cols"] = [{ wch: 24 }, { wch: 72 }];

  const standardRows: Cell[][] = [
    ["标准点", `浓度 (${concentrationUnit})`, "OD450-1", "OD450-2", "OD450-3", "平均 OD450"].map(
      (value) => cell(value, { bold: true, fill: HEADER, align: "center" })
    ),
  ];
  standards.forEach((point, index) => {
    const mean = standardPointMean(point);
    const excelRow = index + 2;
    standardRows.push([
      cell(index + 1),
      numericCell(point.concentration),
      numericCell(point.od1),
      numericCell(point.od2),
      numericCell(point.od3),
      formula(`IFERROR(AVERAGE(C${excelRow}:E${excelRow}),"")`, mean),
    ]);
  });
  const standardSheet = XLSX.utils.aoa_to_sheet(standardRows);
  standardSheet["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  standardSheet["!freeze"] = { ySplit: 1 };

  const resultRows: Cell[][] = [
    [
      "序号",
      "分组",
      "原始 OD450",
      `标曲反算浓度 (${concentrationUnit})`,
      "稀释倍数",
      `终浓度 (${concentrationUnit})`,
      "范围状态",
    ].map((value, index) =>
      cell(value, { bold: true, fill: index === 3 || index === 5 ? RESULT : HEADER, align: "center" })
    ),
  ];
  samples.forEach((sample, index) => {
    const result = calculateElisaSample(sample, fit);
    const excelRow = index + 2;
    const rangeLabel =
      result.range === "within"
        ? "标曲范围内"
        : result.range === "below"
          ? "低于标准 OD 范围"
          : result.range === "above"
            ? "高于标准 OD 范围"
            : sample.od.trim()
              ? "无法计算"
              : "";
    const warningFill = result.range === "within" || result.range === "invalid" ? undefined : WARNING;
    resultRows.push([
      cell(index + 1),
      cell(sample.group),
      numericCell(sample.od, warningFill),
      formula(measuredFormula(fit, excelRow), result.measuredConcentration, RESULT, "0.00"),
      numericCell(sample.dilution),
      formula(`IFERROR(D${excelRow}*E${excelRow},"")`, result.finalConcentration, RESULT, "0.00"),
      cell(rangeLabel, { fill: warningFill }),
    ]);
  });
  const resultSheet = XLSX.utils.aoa_to_sheet(resultRows);
  resultSheet["!cols"] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
  ];
  resultSheet["!freeze"] = { ySplit: 1 };
  resultSheet["!autofilter"] = { ref: `A1:G${samples.length + 1}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, metaSheet, "实验与拟合");
  XLSX.utils.book_append_sheet(workbook, standardSheet, "标准曲线");
  XLSX.utils.book_append_sheet(workbook, resultSheet, "样本结果");
  const calculationWorkbook = workbook as XLSX.WorkBook & {
    Workbook?: XLSX.WBProps & { CalcPr?: Record<string, string> };
  };
  calculationWorkbook.Workbook = {
    ...calculationWorkbook.Workbook,
    CalcPr: { fullCalcOnLoad: "1" },
  };
  const chartImage = await chartPngDataUrl(chartSvg);
  const excelJs = await import("exceljs");
  const enhancedWorkbook = new excelJs.Workbook();
  const baseWorkbook = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  type ExcelJsLoadBuffer = Parameters<typeof enhancedWorkbook.xlsx.load>[0];
  await enhancedWorkbook.xlsx.load(new Uint8Array(baseWorkbook) as unknown as ExcelJsLoadBuffer);
  enhancedWorkbook.calcProperties.fullCalcOnLoad = true;
  const standardWorksheet = enhancedWorkbook.getWorksheet("标准曲线");
  if (!standardWorksheet) throw new Error("未找到标准曲线工作表");
  const chartImageId = enhancedWorkbook.addImage({ base64: chartImage, extension: "png" });
  standardWorksheet.addImage(chartImageId, {
    tl: { col: 7, row: 1 },
    ext: { width: 630, height: 390 },
    editAs: "oneCell",
    hyperlinks: {
      hyperlink: "https://jinshiyu.xyz/elisa",
      tooltip: "jinshiyu.xyz ELISA 计算工具",
    },
  });
  standardWorksheet.getCell("H1").value = "ELISA 标准曲线拟合图";
  standardWorksheet.getCell("H1").font = { name: "Arial", size: 11, bold: true };
  standardWorksheet.getCell("H22").value = "图由 jinshiyu.xyz/elisa 工具根据本工作簿标准点生成";
  standardWorksheet.getCell("H22").font = { name: "Arial", size: 9, color: { argb: "FF667085" } };

  const output = await enhancedWorkbook.xlsx.writeBuffer();
  downloadWorkbook(
    Uint8Array.from(output as unknown as ArrayLike<number>),
    `${sanitizeFilename(experimentName || "ELISA计算")}-${experimentDate || "未填写日期"}.xlsx`
  );
}
