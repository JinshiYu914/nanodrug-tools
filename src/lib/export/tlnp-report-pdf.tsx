"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { describeMethod } from "@/lib/calculations/lnp-bench";
import { formatVolume } from "@/lib/calculations/lnp-formula";
import { computeBenchFormulation } from "@/lib/calculations/lnp-bench";
import {
  computeConjugationDose,
  productName,
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
});

const n = (v: number | null, digits = 1): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

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

function ReportDocument({
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
          {d.conjugation.conditions.length === 0 ? (
            <Text style={styles.empty}>（没有反应条件）</Text>
          ) : (
            <View style={styles.table}>
              <Row
                head
                widths={["18%", "18%", "12%", "13%", "13%", "13%", "13%"]}
                cells={[
                  "条件",
                  "蛋白",
                  "摩尔比",
                  "LNP (µL)",
                  "蛋白 (µL)",
                  "温度/时间",
                  "摇床",
                ]}
              />
              {d.conjugation.conditions.map((c) => {
                const dose = computeConjugationDose(c);
                return (
                  <Row
                    key={c.id}
                    widths={["18%", "18%", "12%", "13%", "13%", "13%", "13%"]}
                    cells={[
                      c.name,
                      c.proteinName || "--",
                      c.targetMolarRatio || "--",
                      formatVolume(dose.lnpVolume_uL),
                      formatVolume(dose.proteinVolume_uL),
                      [c.temperature, c.duration].filter(Boolean).join(" / ") || "--",
                      c.shaking || "--",
                    ]}
                  />
                );
              })}
            </View>
          )}

          {d.conjugation.products.length > 0 && (
            <View style={styles.table}>
              <Row
                head
                widths={["28%", "20%", "20%", "16%", "16%"]}
                cells={["tLNP 产物", "样品", "条件", "浑浊度", "沉淀"]}
              />
              {d.conjugation.products.map((p) => {
                const sample = d.prep.samples.find((x) => x.id === p.sampleId);
                const cond = d.conjugation.conditions.find(
                  (x) => x.id === p.conditionId
                );
                const obs = d.conjugation.results.observations.find(
                  (o) => o.productId === p.id
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
                    key={p.id}
                    widths={["28%", "20%", "20%", "16%", "16%"]}
                    cells={[
                      productName(p, sample?.name ?? "", cond?.name ?? ""),
                      sample?.name ?? "--",
                      cond?.name ?? "--",
                      T[obs?.turbidity ?? ""] ?? "--",
                      P[obs?.precipitate ?? ""] ?? "--",
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
                  ["buffer", p.cl4b.buffer]
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
              return cells.map(([label, value]) => (
                <View key={label} style={styles.metaCell}>
                  <Text style={styles.metaLabel}>{label}</Text>
                  <Text style={styles.metaValue}>{value || "--"}</Text>
                </View>
              ));
            })()}
          </View>

          {d.purification.chromatograms.length > 0 && (
            <View style={styles.table}>
              <Row
                head
                widths={["34%", "22%", "22%", "22%"]}
                cells={["层析图", "数据点", "通道", "来源"]}
              />
              {d.purification.chromatograms.map((c) => (
                <Row
                  key={c.id}
                  widths={["34%", "22%", "22%", "22%"]}
                  cells={[
                    c.name,
                    String(c.points.length),
                    c.channels.map((ch) => ch.label).join(" / "),
                    c.sourceName || "--",
                  ]}
                />
              ))}
            </View>
          )}

          {(() => {
            const ee = resolveEe(d.purification.results.ee);
            const dls = d.purification.results.dls;
            if (ee.source === "none" && !dls.size_nm && !dls.pdi) return null;
            return (
              <Text style={styles.note}>
                纯化后：包封率 {n(ee.ee)}% · 回收率 {n(ee.yield_)}% · 粒径{" "}
                {dls.size_nm || "--"} nm · PDI {dls.pdi || "--"}
              </Text>
            );
          })()}
          <Note label="TEM" text={d.purification.results.tem.note} />
          <Note label="结果与讨论" text={d.purification.results.discussion} />
        </Section>

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
    <ReportDocument
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
