"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Line,
  Path,
  Rect,
  Text as SvgText,
  pdf,
} from "@react-pdf/renderer";
import {
  buildChromatogramPaths,
  channelPeaks,
  chromatogramDomain,
  type PlotBox,
} from "@/lib/calculations/chromatogram";
import { fmtTick, ticksOf } from "@/lib/calculations/chart-scale";
import type { Chromatogram } from "@/lib/calculations/tlnp-experiment";
import { describeMethod } from "@/lib/calculations/lnp-bench";
import { formatVolume } from "@/lib/calculations/lnp-formula";
import { computeBenchFormulation } from "@/lib/calculations/lnp-bench";
import {
  computeConjugationDose,
  findProtein,
  proteinName,
  systemName,
} from "@/lib/calculations/tlnp-conjugation";
import {
  PURIFICATION_METHOD_LABELS,
  resolveEe,
  summarizeBatch,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { ensureCjkFonts } from "./pdf-fonts";

/**
 * The whole-batch report.
 *
 * Module 2 prints as an adjacency table rather than a picture: @react-pdf can't
 * mount the canvas, and rasterizing it would mean another dependency for a
 * diagram that reads perfectly well as 样品 → 条件 → 产物 rows.
 */

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    fontSize: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    lineHeight: 1.3,
    color: "#222",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1pt solid #222",
  },
  title: { fontSize: 13, fontWeight: 700 },
  meta: { fontSize: 8, color: "#555", textAlign: "right" },
  section: { marginTop: 10 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
    paddingBottom: 2,
    borderBottom: "0.5pt solid #999",
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  metaCell: { width: "33.33%", paddingRight: 6, marginBottom: 2 },
  metaLabel: { fontSize: 7, color: "#777" },
  metaValue: { fontSize: 8 },
  table: { marginTop: 3 },
  tr: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #e5e5e5",
    paddingVertical: 2,
  },
  th: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #999",
    paddingBottom: 2,
    marginBottom: 1,
  },
  thText: { fontSize: 7, fontWeight: 700, color: "#555" },
  td: { fontSize: 7.5 },
  note: {
    marginTop: 3,
    padding: 4,
    backgroundColor: "#f6f6f6",
    borderRadius: 2,
    fontSize: 7.5,
    color: "#333",
  },
  empty: { fontSize: 7.5, color: "#888", marginTop: 2 },
  figureTitle: { fontSize: 8.5, fontWeight: 700, marginTop: 6, marginBottom: 2 },
  axisRow: { marginTop: 1 },
  axisNote: { fontSize: 6.5, color: "#777" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  legendSwatch: { width: 6, height: 6, borderRadius: 3, marginRight: 3 },
  legendText: { fontSize: 7 },
});

const n = (v: number | null, digits = 1): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

// ─── Chromatogram ─────────────────────────────────────────
//
// The page has no CSS custom properties, so the on-screen chart's token-based
// colours can't come along. These are the print equivalents of chart-1..5,
// picked to stay distinguishable in greyscale as well as colour — a printed
// chromatogram is frequently photocopied.
const PRINT_CHANNEL_COLORS = [
  "#c2410c",
  "#0f766e",
  "#a21caf",
  "#4338ca",
  "#15803d",
];

const CHART_W = 520;
const CHART_H = 190;
const CHART_PAD = { top: 8, right: 10, bottom: 22, left: 40 };
const CHART_BOX: PlotBox = {
  left: CHART_PAD.left,
  top: CHART_PAD.top,
  width: CHART_W - CHART_PAD.left - CHART_PAD.right,
  height: CHART_H - CHART_PAD.top - CHART_PAD.bottom,
};

/**
 * The same peak the user sees on screen.
 *
 * Geometry comes from buildChromatogramPaths, shared with chromatogram-chart
 * so the printed curve cannot drift from the rendered one — only the palette
 * and the box differ.
 */
function ChromatogramFigure({ c }: { c: Chromatogram }) {
  const domains = chromatogramDomain(c);
  const paths = buildChromatogramPaths(c, domains, CHART_BOX);
  const peaks = channelPeaks(c);

  const sx = (v: number) =>
    CHART_BOX.left +
    ((v - domains.x.lo) / (domains.x.hi - domains.x.lo || 1)) * CHART_BOX.width;
  const sy = (v: number) =>
    CHART_BOX.top +
    CHART_BOX.height -
    ((v - domains.y.lo) / (domains.y.hi - domains.y.lo || 1)) * CHART_BOX.height;

  if (domains.empty) {
    return <Text style={styles.empty}>（该层析图没有可绘制的数据）</Text>;
  }

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {c.fractions.map((f) => {
          const x1 = sx(Math.min(f.from, f.to));
          const x2 = sx(Math.max(f.from, f.to));
          return (
            <Rect
              key={f.id}
              x={x1}
              y={CHART_BOX.top}
              width={Math.max(x2 - x1, 1)}
              height={CHART_BOX.height}
              fill="#e8e8f0"
            />
          );
        })}

        {ticksOf(domains.y).map((t) => (
          <Line
            key={`gy${t}`}
            x1={CHART_BOX.left}
            x2={CHART_W - CHART_PAD.right}
            y1={sy(t)}
            y2={sy(t)}
            strokeWidth={0.5}
            stroke="#e0e0e0"
          />
        ))}
        {ticksOf(domains.x).map((t) => (
          <Line
            key={`gx${t}`}
            y1={CHART_BOX.top}
            y2={CHART_H - CHART_PAD.bottom}
            x1={sx(t)}
            x2={sx(t)}
            strokeWidth={0.5}
            stroke="#e0e0e0"
          />
        ))}

        <Line
          x1={CHART_BOX.left}
          x2={CHART_BOX.left}
          y1={CHART_BOX.top}
          y2={CHART_H - CHART_PAD.bottom}
          strokeWidth={0.8}
          stroke="#888"
        />
        <Line
          x1={CHART_BOX.left}
          x2={CHART_W - CHART_PAD.right}
          y1={CHART_H - CHART_PAD.bottom}
          y2={CHART_H - CHART_PAD.bottom}
          strokeWidth={0.8}
          stroke="#888"
        />

        {paths.map((d, i) =>
          d ? (
            <Path
              key={c.channels[i].id}
              d={d}
              strokeWidth={1.2}
              stroke={PRINT_CHANNEL_COLORS[i % PRINT_CHANNEL_COLORS.length]}
              fill="none"
            />
          ) : null
        )}

        {/* Tick numbers, so a peak position can be read straight off the axis
            rather than only from the legend. Digits are ASCII, so these render
            regardless of which font the SVG layer resolves. */}
        {ticksOf(domains.y).map((t) => (
          <SvgText
            key={`ty${t}`}
            x={CHART_BOX.left - 4}
            y={sy(t) + 2}
            style={{ fontSize: 6, fill: "#666" }}
            textAnchor="end"
          >
            {fmtTick(t)}
          </SvgText>
        ))}
        {ticksOf(domains.x).map((t) => (
          <SvgText
            key={`tx${t}`}
            x={sx(t)}
            y={CHART_H - CHART_PAD.bottom + 9}
            style={{ fontSize: 6, fill: "#666" }}
            textAnchor="middle"
          >
            {fmtTick(t)}
          </SvgText>
        ))}
      </Svg>

      {/* The axis NAMES stay outside the Svg: they carry CJK (体积 / 吸光度),
          and the SVG text layer does not reliably resolve the registered CJK
          font the way the document body does. */}
      <View style={styles.axisRow}>
        <Text style={styles.axisNote}>
          横轴：{c.xLabel}　纵轴：吸光度
        </Text>
      </View>
      <View style={styles.legendRow}>
        {c.channels.map((ch, i) => (
          <View key={ch.id} style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                {
                  backgroundColor:
                    PRINT_CHANNEL_COLORS[i % PRINT_CHANNEL_COLORS.length],
                },
              ]}
            />
            <Text style={styles.legendText}>
              {ch.label}
              {isFinite(peaks[i]?.x)
                ? ` 峰值 ${peaks[i].y.toPrecision(3)} @ ${peaks[i].x.toPrecision(3)}`
                : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({
  cells,
  widths,
  head,
}: {
  cells: string[];
  widths: string[];
  head?: boolean;
}) {
  return (
    <View style={head ? styles.th : styles.tr}>
      {cells.map((c, i) => (
        <Text
          key={i}
          style={[
            head ? styles.thText : styles.td,
            { width: widths[i], paddingRight: 4 },
          ]}
        >
          {c}
        </Text>
      ))}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <Text style={styles.note}>
      {label}：{text}
    </Text>
  );
}

/** Exported so the document can be rendered headlessly without a DOM. */
export function TlnpReportDocument({
  batchName,
  createdAt,
  updatedAt,
  d,
}: {
  batchName: string;
  createdAt: string;
  updatedAt: string;
  d: TlnpExperimentData;
}) {
  const s = summarizeBatch(d);
  const fmtDate = (iso: string) => {
    const x = new Date(iso);
    const p = (v: number) => String(v).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{batchName}</Text>
          <Text style={styles.meta}>
            tLNP 实验记录{"\n"}
            创建 {fmtDate(createdAt)} · 更新 {fmtDate(updatedAt)}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          {[
            ["批次编号", d.meta.batchCode],
            ["实验日期", d.meta.experimentDate],
            ["负责人", d.meta.operator],
            // Each module records its own date; the batch spans all of them.
            ["制备日期", d.prep.design.date],
            ["偶联日期", d.conjugation.design.date],
            ["纯化日期", d.purification.design.date],
            [
              "体内外日期",
              d.assay.invitro.design.date || d.assay.invivo.design.date,
            ],
            ["阳离子脂质", s.cationicLipid],
            ["反应 linker", s.linker],
            ["Cargo", s.cargo],
            ["制备方法", s.mixing],
            ["溶剂置换", s.solventLabel],
            ["纯化方式", s.purificationLabel],
          ].map(([label, value]) => (
            <View key={label} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaValue}>{value || "--"}</Text>
            </View>
          ))}
        </View>
        {d.meta.objective.trim() !== "" && (
          <Note label="实验目的" text={d.meta.objective} />
        )}

        {/* ── 1 LNP 制备 ── */}
        <Section title="1  LNP 制备">
          {d.prep.samples.length === 0 ? (
            <Text style={styles.empty}>（没有样品）</Text>
          ) : (
            <View style={styles.table}>
              <Row
                head
                widths={["18%", "22%", "12%", "12%", "12%", "12%", "12%"]}
                cells={[
                  "样品",
                  "组成 / 比例",
                  "脂相 (µL)",
                  "水相 (µL)",
                  "包封率 %",
                  "粒径 nm",
                  "PDI",
                ]}
              />
              {d.prep.samples.map((sample, i) => {
                const c = computeBenchFormulation(sample);
                const ee = resolveEe(sample.ee);
                const ratios = sample.lipidEntries
                  .map((e) => e.molarRatio || "0")
                  .join(":");
                return (
                  <Row
                    key={sample.id}
                    widths={["18%", "22%", "12%", "12%", "12%", "12%", "12%"]}
                    cells={[
                      sample.name || `样品 ${i + 1}`,
                      ratios,
                      formatVolume(c.prepVolumes.organicTotal_uL),
                      formatVolume(c.prepVolumes.aqueousTotal_uL),
                      n(ee.ee),
                      sample.dls.size_nm || "--",
                      sample.dls.pdi || "--",
                    ]}
                  />
                );
              })}
            </View>
          )}
          <Note label="溶剂置换" text={describeMethod(d.prep.design.solvent.method)} />
          <Note label="设计备注" text={d.prep.design.note} />
          <Note label="结果与讨论" text={d.prep.results.discussion} />
        </Section>

        {/* ── 2 偶联反应 ── */}
        <Section title="2  偶联反应">
          {d.conjugation.proteins.length > 0 && (
            <View style={styles.table}>
              <Row
                head
                widths={["34%", "22%", "22%", "22%"]}
                cells={["蛋白", "分子量 (Da)", "浓度", "备注"]}
              />
              {d.conjugation.proteins.map((p, i) => (
                <Row
                  key={p.id}
                  widths={["34%", "22%", "22%", "22%"]}
                  cells={[
                    proteinName(p, i),
                    p.mw || "--",
                    p.conc
                      ? `${p.conc} ${p.concUnit === "uM" ? "µM" : "mg/mL"}`
                      : "--",
                    p.note || "--",
                  ]}
                />
              ))}
            </View>
          )}

          {d.conjugation.systems.length === 0 ? (
            <Text style={styles.empty}>（没有反应体系）</Text>
          ) : (
            <View style={styles.table}>
              <Row
                head
                widths={["16%", "14%", "12%", "12%", "12%", "12%", "10%", "12%"]}
                cells={[
                  "反应体系",
                  "蛋白",
                  "linker:蛋白",
                  "LNP (µL)",
                  "蛋白 (µL)",
                  "buffer (µL)",
                  "总 (µL)",
                  "温度/时间",
                ]}
              />
              {d.conjugation.systems.map((sys, i) => {
                const protein = findProtein(d.conjugation.proteins, sys.proteinId);
                const dose = computeConjugationDose(sys, protein);
                return (
                  <Row
                    key={sys.id}
                    widths={["16%", "14%", "12%", "12%", "12%", "12%", "10%", "12%"]}
                    cells={[
                      systemName(sys, i),
                      proteinName(protein) || "--",
                      sys.molarRatio ? `1:${sys.molarRatio}` : "--",
                      formatVolume(dose.lnpVolume_uL),
                      formatVolume(dose.proteinVolume_uL),
                      formatVolume(dose.bufferVolume_uL),
                      formatVolume(dose.totalVolume_uL),
                      [sys.temperature, sys.duration].filter(Boolean).join(" / ") ||
                        "--",
                    ]}
                  />
                );
              })}
            </View>
          )}

          {d.conjugation.results.observations.length > 0 && (
            <View style={styles.table}>
              <Row
                head
                widths={["36%", "20%", "20%", "24%"]}
                cells={["反应体系", "浑浊度", "沉淀", "观测备注"]}
              />
              {d.conjugation.results.observations.map((o) => {
                const at = d.conjugation.systems.findIndex(
                  (x) => x.id === o.systemId
                );
                const T: Record<string, string> = {
                  clear: "澄清",
                  slight: "微浑",
                  turbid: "浑浊",
                };
                const P: Record<string, string> = {
                  none: "无",
                  slight: "少量",
                  heavy: "大量",
                };
                return (
                  <Row
                    key={o.id}
                    widths={["36%", "20%", "20%", "24%"]}
                    cells={[
                      at >= 0
                        ? systemName(d.conjugation.systems[at], at)
                        : "（未关联）",
                      T[o.turbidity] ?? "--",
                      P[o.precipitate] ?? "--",
                      o.note || "--",
                    ]}
                  />
                );
              })}
            </View>
          )}
          <Note label="结果与讨论" text={d.conjugation.results.discussion} />
        </Section>

        {/* ── 3 LNP 纯化 ── */}
        <Section title="3  LNP 纯化">
          <View style={styles.metaGrid}>
            {(() => {
              const p = d.purification.design;
              const cells: [string, string][] = [
                [
                  "纯化方式",
                  p.method ? PURIFICATION_METHOD_LABELS[p.method] : "",
                ],
              ];
              if (p.method === "cl4b") {
                cells.push(
                  ["柱长 × 柱径", `${p.cl4b.columnLength} × ${p.cl4b.columnDiameter} cm`],
                  ["流速", `${p.cl4b.flowRate} mL/min`],
                  ["buffer", p.cl4b.buffer],
                  ["超滤浓缩", p.cl4b.ultrafiltrationConcentrate ? "是" : "否"]
                );
              } else if (p.method === "ultrafiltration") {
                cells.push(
                  ["截留分子量", `${p.ultrafiltration.mwco} kDa`],
                  ["次数", p.ultrafiltration.cycles]
                );
              } else if (p.method === "dialysis") {
                cells.push(
                  ["截留分子量", `${p.dialysis.mwco} kDa`],
                  ["时长", p.dialysis.duration],
                  ["buffer", p.dialysis.buffer]
                );
              }
              cells.push(["操作人", p.operator], ["日期", p.date]);
              return cells.map(([label, value]) => (
                <View key={label} style={styles.metaCell}>
                  <Text style={styles.metaLabel}>{label}</Text>
                  <Text style={styles.metaValue}>{value || "--"}</Text>
                </View>
              ));
            })()}
          </View>

          {d.purification.results.systems.length > 0 && (
            <View style={styles.table}>
              <Row
                head
                widths={["24%", "16%", "15%", "15%", "15%", "15%"]}
                cells={[
                  "反应体系",
                  "浓度 ng/µL",
                  "包封率 %",
                  "回收率 %",
                  "粒径 nm",
                  "PDI",
                ]}
              />
              {d.conjugation.systems.map((sys, i) => {
                const r = d.purification.results.systems.find(
                  (x) => x.systemId === sys.id
                );
                if (!r) return null;
                const ee = resolveEe(r.ee);
                return (
                  <Row
                    key={sys.id}
                    widths={["24%", "16%", "15%", "15%", "15%", "15%"]}
                    cells={[
                      systemName(sys, i),
                      n(ee.conc, 2),
                      n(ee.ee),
                      n(ee.yield_),
                      r.dls.size_nm || "--",
                      r.dls.pdi || "--",
                    ]}
                  />
                );
              })}
            </View>
          )}
          <Note label="TEM" text={d.purification.results.tem.note} />
          <Note label="结果与讨论" text={d.purification.results.discussion} />
        </Section>

        {/* Each figure gets its own wrap={false} block so a peak is never
            split across a page break. */}
        {d.purification.chromatograms.map((c) => (
          <View key={c.id} style={styles.section} wrap={false}>
            <Text style={styles.figureTitle}>层析图 · {c.name}</Text>
            <ChromatogramFigure c={c} />
            {c.note.trim() !== "" && <Note label="备注" text={c.note} />}
          </View>
        ))}

        {/* ── 4 体内外实验 ── */}
        <Section title="4  体内外实验">
          {(["invitro", "invivo"] as const).map((arm) => {
            const block = d.assay[arm];
            const label = arm === "invitro" ? "体外" : "体内";
            const design =
              arm === "invitro"
                ? [
                    ["细胞系", d.assay.invitro.design.cellLine],
                    ["代数", d.assay.invitro.design.passage],
                    ["孔板", d.assay.invitro.design.plate],
                    ["细胞密度", d.assay.invitro.design.seedingDensity],
                    ["剂量", d.assay.invitro.design.dose],
                    ["时间点", d.assay.invitro.design.timepoints],
                  ]
                : [
                    ["动物", d.assay.invivo.design.species],
                    ["品系", d.assay.invivo.design.strain],
                    ["给药途径", d.assay.invivo.design.route],
                    ["剂量", d.assay.invivo.design.dose],
                    ["分组", d.assay.invivo.design.groups],
                    ["时间点", d.assay.invivo.design.timepoints],
                  ];
            const hasAny =
              design.some(([, v]) => v.trim() !== "") ||
              block.results.rows.length > 0 ||
              block.results.discussion.trim() !== "";
            if (!hasAny) return null;

            return (
              <View key={arm} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 8.5, fontWeight: 700, marginTop: 3 }}>
                  {label}
                </Text>
                <View style={styles.metaGrid}>
                  {design.map(([l, v]) => (
                    <View key={l} style={styles.metaCell}>
                      <Text style={styles.metaLabel}>{l}</Text>
                      <Text style={styles.metaValue}>{v || "--"}</Text>
                    </View>
                  ))}
                </View>
                {block.results.rows.length > 0 && (
                  <View style={styles.table}>
                    <Row
                      head
                      widths={["30%", "18%", "18%", "14%", "20%"]}
                      cells={["样本", "分组", "数值", "单位", "备注"]}
                    />
                    {block.results.rows.map((r) => (
                      <Row
                        key={r.id}
                        widths={["30%", "18%", "18%", "14%", "20%"]}
                        cells={[
                          r.label || "--",
                          r.group || "--",
                          r.value || "--",
                          r.unit || "",
                          r.note || "",
                        ]}
                      />
                    ))}
                  </View>
                )}
                <Note label="结果分析" text={block.results.discussion} />
              </View>
            );
          })}
        </Section>
      </Page>
    </Document>
  );
}

export async function exportTlnpToPdf(
  batchName: string,
  createdAt: string,
  updatedAt: string,
  d: TlnpExperimentData
): Promise<void> {
  ensureCjkFonts();

  const blob = await pdf(
    <TlnpReportDocument
      batchName={batchName}
      createdAt={createdAt}
      updatedAt={updatedAt}
      d={d}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  a.download = `${batchName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "tlnp-batch"}-${stamp.getFullYear()}${p(stamp.getMonth() + 1)}${p(stamp.getDate())}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
