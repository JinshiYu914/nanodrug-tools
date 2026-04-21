"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import {
  computeBenchFormulation,
  type BenchFormulation,
} from "@/lib/calculations/lnp-bench";
import { formatVolume } from "@/lib/calculations/lnp-formula";

// Register CJK fonts (copied from @fontsource/noto-sans-sc into /public/fonts).
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: "NotoSansSC",
      fonts: [
        { src: "/fonts/NotoSansSC-Regular.woff", fontWeight: 400 },
        { src: "/fonts/NotoSansSC-Bold.woff", fontWeight: 700 },
      ],
    });
    fontsRegistered = true;
  } catch (e) {
    console.warn("CJK font registration failed; CJK characters may not render", e);
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    fontSize: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    lineHeight: 1.25,
    color: "#222",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: "1pt solid #222",
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
  },
  meta: {
    fontSize: 8,
    color: "#555",
    textAlign: "right",
  },
  sessionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    marginBottom: 5,
    fontSize: 8,
    color: "#555",
  },
  card: {
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
    border: "0.5pt solid #ccc",
    borderRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  cardIndex: {
    width: 18,
    fontWeight: 700,
    fontSize: 9,
  },
  cardName: {
    fontWeight: 700,
    fontSize: 10,
    flex: 1,
  },
  cardDate: {
    fontSize: 7,
    color: "#888",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    paddingTop: 2,
    borderTop: "0.5pt solid #eee",
  },
  sectionLabel: {
    width: 40,
    fontSize: 8,
    fontWeight: 700,
    color: "#555",
    paddingTop: 1,
  },
  sectionBody: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  lipidCell: {
    width: "25%",
    paddingRight: 6,
  },
  lipidName: {
    fontSize: 8,
    fontWeight: 700,
  },
  lipidDetail: {
    fontSize: 7,
    color: "#555",
  },
  lipidVolume: {
    fontSize: 8,
    fontWeight: 700,
    color: "#1a6b4a",
  },
  paramCell: {
    marginRight: 12,
    fontSize: 8,
  },
  paramLabel: {
    color: "#888",
  },
  paramValue: {
    fontWeight: 700,
  },
  volumeCell: {
    marginRight: 12,
    fontSize: 8,
  },
  volumeTitle: {
    color: "#888",
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 8,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
});

interface BenchDocumentProps {
  sessionName: string;
  createdAt: string;
  updatedAt: string;
  formulations: BenchFormulation[];
  exportedAt: Date;
}

export function BenchDocument({
  sessionName,
  createdAt,
  updatedAt,
  formulations,
  exportedAt,
}: BenchDocumentProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>LNP 配方筛选 · {sessionName}</Text>
          </View>
          <View>
            <Text style={styles.meta}>
              导出时间: {formatDateTime(exportedAt)}
            </Text>
            <Text style={styles.meta}>共 {formulations.length} 个配方</Text>
          </View>
        </View>

        <View style={styles.sessionBar}>
          <Text>创建: {formatDateTimeIso(createdAt)}</Text>
          <Text>最近更新: {formatDateTimeIso(updatedAt)}</Text>
        </View>

        {formulations.map((f, i) => (
          <FormulationCard
            key={f.id}
            index={i + 1}
            formulation={f}
            breakPage={i > 0 && i % 4 === 0}
          />
        ))}

        <View style={styles.footer} fixed>
          <Text>nanodrug-tools · LNP Formulation Screening</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `第 ${pageNumber} / ${totalPages} 页`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function FormulationCard({
  index,
  formulation,
  breakPage,
}: {
  index: number;
  formulation: BenchFormulation;
  breakPage: boolean;
}) {
  const computed = computeBenchFormulation(formulation);
  const { prepVolumes, stockVolumes, totalConc } = computed;

  return (
    <View style={styles.card} wrap={false} break={breakPage}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index}</Text>
        <Text style={styles.cardName}>
          {formulation.name || "(未命名)"}
        </Text>
        <Text style={styles.cardDate}>
          {formatDateTimeIso(formulation.createdAt)}
        </Text>
      </View>

      {/* 配方 */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>配方</Text>
        <View style={styles.sectionBody}>
          {formulation.lipidEntries.map((e) => {
            const name = e.isCustomLipid ? e.customLipidName : e.lipidName;
            const vol = stockVolumes?.[e.id];
            return (
              <View key={e.id} style={styles.lipidCell}>
                <Text style={styles.lipidName}>{name || "?"}</Text>
                <Text style={styles.lipidDetail}>
                  {e.molarRatio || "0"}% · MW {e.molarWeight || "?"} · Stock{" "}
                  {e.stockConc || "?"} mg/mL
                </Text>
                <Text style={styles.lipidVolume}>
                  吸取 {vol ? formatVolume(vol.uL) : "--"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 制备参数 */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>制备参数</Text>
        <View style={styles.sectionBody}>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>N/P </Text>
            <Text style={styles.paramValue}>
              {formulation.prep.npRatio || "-"}
            </Text>
          </Text>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>脂相浓度 </Text>
            <Text style={styles.paramValue}>
              {formulation.prep.masterConc || "-"} mM
            </Text>
          </Text>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>FRR </Text>
            <Text style={styles.paramValue}>
              {formulation.prep.frrAqueous}:{formulation.prep.frrOrganic}
            </Text>
          </Text>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>RNA </Text>
            <Text style={styles.paramValue}>
              {formulation.prep.rnaMass || "-"} µg · {formulation.prep.naType}
            </Text>
          </Text>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>RNA 浓度 </Text>
            <Text style={styles.paramValue}>
              {formulation.prep.rnaConc || "-"} µg/µL
            </Text>
          </Text>
          <Text style={styles.paramCell}>
            <Text style={styles.paramLabel}>Lipid Mix 总浓度 </Text>
            <Text style={styles.paramValue}>
              {totalConc ? `${totalConc.mM.toFixed(2)} mM` : "--"}
            </Text>
          </Text>
        </View>
      </View>

      {/* 体积 */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>体积</Text>
        <View style={styles.sectionBody}>
          <Text style={styles.volumeCell}>
            <Text style={styles.volumeTitle}>脂相 </Text>
            Lipid mix{" "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.lipidMix_uL)}
            </Text>
            {" + EtOH "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.ethanol_uL)}
            </Text>
            {" = "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.organicTotal_uL)}
            </Text>
          </Text>
          <Text style={styles.volumeCell}>
            <Text style={styles.volumeTitle}>水相 </Text>
            RNA{" "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.rnaVolume_uL)}
            </Text>
            {" + CB "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.cbBuffer_uL)}
            </Text>
            {" = "}
            <Text style={{ fontWeight: 700 }}>
              {formatVolume(prepVolumes.aqueousTotal_uL)}
            </Text>
          </Text>
          <Text style={styles.volumeCell}>
            <Text style={styles.volumeTitle}>两相总体积 </Text>
            {prepVolumes.aqueousTotal_uL !== null &&
            prepVolumes.organicTotal_uL !== null ? (
              <Text style={{ fontWeight: 700 }}>
                {formatVolume(
                  prepVolumes.aqueousTotal_uL + prepVolumes.organicTotal_uL
                )}
              </Text>
            ) : (
              <Text>--</Text>
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Entry point ──────────────────────────────────────────

export async function exportBenchToPdf(
  sessionName: string,
  createdAt: string,
  updatedAt: string,
  formulations: BenchFormulation[]
): Promise<void> {
  if (formulations.length === 0) return;
  ensureFonts();

  const blob = await pdf(
    <BenchDocument
      sessionName={sessionName}
      createdAt={createdAt}
      updatedAt={updatedAt}
      formulations={formulations}
      exportedAt={new Date()}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(sessionName)}-${datestamp()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeIso(iso: string): string {
  return formatDateTime(new Date(iso));
}

function datestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "lnp-screening";
}
