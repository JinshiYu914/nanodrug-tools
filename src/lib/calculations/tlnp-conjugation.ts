/**
 * Conjugation dosing and the sample × condition graph.
 *
 * Pure functions only. `deriveProducts` in particular is shared by the canvas,
 * the report and the exporters, so all three agree on which tLNPs exist without
 * anyone recomputing it slightly differently.
 */

import type {
  ConjugateProduct,
  ReactionCondition,
  TlnpFlowEdge,
  TlnpFlowNode,
} from "./tlnp-experiment";
import { genId } from "./ribogreen";

const num = (s: string): number => {
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
};

/** Average MW per nucleotide for single-stranded RNA, sodium salt. */
const MW_PER_NT = 330;
/** Used when the user hasn't said how long the cargo is. */
const DEFAULT_RNA_NT = 1000;

export interface ConjugationDose {
  /** How much LNP stock to take. */
  lnpVolume_uL: number | null;
  proteinVolume_uL: number | null;
  /** Always null today: nothing in the form pins a target volume, so there is
   *  no make-up volume to solve for. Kept so adding one later is additive. */
  bufferVolume_uL: number | null;
  totalVolume_uL: number | null;
  lnpRna_nmol: number | null;
  protein_nmol: number | null;
  /** Non-blocking notes — physically impossible or missing inputs. */
  warnings: string[];
}

const EMPTY_DOSE: ConjugationDose = {
  lnpVolume_uL: null,
  proteinVolume_uL: null,
  bufferVolume_uL: null,
  totalVolume_uL: null,
  lnpRna_nmol: null,
  protein_nmol: null,
  warnings: [],
};

/**
 * Work out the 加样体系 for one reaction condition.
 *
 * LNP amount is expressed on an RNA basis — ng/µL is what RiboGreen reports, so
 * the two tools speak the same units — and converted to moles through the RNA
 * length. The target molar ratio is 蛋白 : LNP-RNA.
 */
export function computeConjugationDose(
  c: ReactionCondition
): ConjugationDose {
  const warnings: string[] = [];

  const conc = num(c.lnpConc);
  const amount = num(c.lnpAmount);
  const ratio = num(c.targetMolarRatio);
  const proteinMW = num(c.proteinMW);
  const proteinConc = num(c.proteinConc);
  const nt = isFinite(num(c.rnaLength_nt)) && num(c.rnaLength_nt) > 0
    ? num(c.rnaLength_nt)
    : DEFAULT_RNA_NT;

  if (!(conc > 0)) warnings.push("缺 LNP 浓度");
  if (!(amount > 0)) warnings.push("缺 LNP 用量");
  if (!(ratio > 0)) warnings.push("缺目标摩尔比");
  if (!(proteinMW > 0)) warnings.push("缺蛋白分子量");
  if (!(proteinConc > 0)) warnings.push("缺蛋白浓度");

  if (!(conc > 0) || !(amount > 0)) return { ...EMPTY_DOSE, warnings };

  // ng of RNA taken, and the volume of LNP stock that represents.
  const rnaMass_ng = c.lnpAmountUnit === "ug" ? amount * 1000 : amount * conc;
  const lnpVolume_uL = c.lnpAmountUnit === "ug" ? rnaMass_ng / conc : amount;

  // ng / (g/mol) → nmol, since ng/g and nmol/mol cancel.
  const rnaMW = nt * MW_PER_NT;
  const lnpRna_nmol = rnaMass_ng / rnaMW;

  if (!(ratio > 0) || !(proteinMW > 0) || !(proteinConc > 0)) {
    return {
      ...EMPTY_DOSE,
      lnpVolume_uL,
      lnpRna_nmol,
      warnings,
    };
  }

  const protein_nmol = lnpRna_nmol * ratio;

  // Concentration → nmol per µL.
  //   mg/mL is numerically µg/µL, and (u µg/µL) / (MW g/mol) = u·1000/MW nmol/µL.
  //   µM is µmol/L, which is 1e-3 nmol/µL.
  const proteinConc_nmol_per_uL =
    c.proteinConcUnit === "uM"
      ? proteinConc / 1000
      : (proteinConc * 1000) / proteinMW;

  const proteinVolume_uL =
    proteinConc_nmol_per_uL > 0 ? protein_nmol / proteinConc_nmol_per_uL : null;

  // The reaction is simply the two volumes combined. There is no make-up buffer
  // to solve for unless the user pins a target volume, which this form doesn't
  // ask for — reporting a number here would be inventing one.
  const bufferVolume_uL = null;
  const totalVolume_uL =
    proteinVolume_uL !== null ? lnpVolume_uL + proteinVolume_uL : lnpVolume_uL;

  // Not an error — it still reacts — but past ~2× the LNP volume the particles
  // are being meaningfully diluted, which changes the kinetics.
  if (proteinVolume_uL !== null && proteinVolume_uL > lnpVolume_uL * 2) {
    warnings.push("蛋白取用体积远大于 LNP 体积，反应体系被明显稀释");
  }

  return {
    lnpVolume_uL,
    proteinVolume_uL,
    bufferVolume_uL,
    totalVolume_uL,
    lnpRna_nmol,
    protein_nmol,
    warnings,
  };
}

/** One-line summary for the node body and the exports. */
export function describeConditionDose(c: ReactionCondition): string {
  const d = computeConjugationDose(c);
  const parts: string[] = [];
  if (c.targetMolarRatio) parts.push(`蛋白:LNP ${c.targetMolarRatio}`);
  if (d.proteinVolume_uL !== null) {
    parts.push(`蛋白 ${d.proteinVolume_uL.toFixed(1)} µL`);
  }
  const cond = [c.temperature, c.duration, c.shaking].filter(Boolean).join(" · ");
  if (cond) parts.push(cond);
  return parts.join(" / ");
}

// ─── Graph ────────────────────────────────────────────────

export const nodeId = (kind: "s" | "c" | "p", refId: string) =>
  `${kind}:${refId}`;

/** Is this a connection the graph allows? Only 样品 → 条件. */
export function isValidConnection(
  nodes: TlnpFlowNode[],
  edges: TlnpFlowEdge[],
  source: string,
  target: string
): { ok: true } | { ok: false; reason: string } {
  if (source === target) return { ok: false, reason: "不能连到自己" };
  const s = nodes.find((n) => n.id === source);
  const t = nodes.find((n) => n.id === target);
  if (!s || !t) return { ok: false, reason: "节点不存在" };
  if (s.kind !== "sample" || t.kind !== "condition") {
    return { ok: false, reason: "只能从样品连到反应条件" };
  }
  if (edges.some((e) => e.source === source && e.target === target)) {
    return { ok: false, reason: "这条连线已经存在" };
  }
  return { ok: true };
}

/**
 * One product per sample→condition edge.
 *
 * Existing products are kept by (sampleId, conditionId) so a user-set name
 * override survives an unrelated edit to the graph; products whose edge is gone
 * are dropped.
 */
export function deriveProducts(
  nodes: TlnpFlowNode[],
  edges: TlnpFlowEdge[],
  existing: ConjugateProduct[]
): ConjugateProduct[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: ConjugateProduct[] = [];

  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t || s.kind !== "sample" || t.kind !== "condition") continue;
    const prev = existing.find(
      (p) => p.sampleId === s.refId && p.conditionId === t.refId
    );
    out.push(
      prev ?? {
        id: genId(),
        nameOverride: "",
        sampleId: s.refId,
        conditionId: t.refId,
      }
    );
  }

  return out;
}

export function productName(
  product: ConjugateProduct,
  sampleName: string,
  conditionName: string
): string {
  if (product.nameOverride.trim()) return product.nameOverride.trim();
  return `${sampleName || "样品"}-${conditionName || "条件"}`;
}

// ─── Layout ───────────────────────────────────────────────

const COL_SAMPLE_X = 0;
const COL_CONDITION_X = 320;
const COL_PRODUCT_X = 640;
const ROW_H = 96;

/**
 * Place any node that doesn't have a position yet, in three columns: samples on
 * the left, conditions in the middle, products on the right. Nodes the user has
 * already dragged keep their coordinates.
 */
export function layoutNodes(
  samples: { id: string; name: string }[],
  conditions: { id: string; name: string }[],
  products: { id: string; label: string }[],
  existing: TlnpFlowNode[]
): TlnpFlowNode[] {
  const prev = new Map(existing.map((n) => [n.id, n]));

  const place = (
    kind: TlnpFlowNode["kind"],
    prefix: "s" | "c" | "p",
    items: { id: string; label: string }[],
    x: number
  ): TlnpFlowNode[] =>
    items.map((item, i) => {
      const id = nodeId(prefix, item.id);
      const old = prev.get(id);
      return {
        id,
        kind,
        refId: item.id,
        label: item.label,
        position: old?.position ?? { x, y: i * ROW_H },
      };
    });

  return [
    ...place(
      "sample",
      "s",
      samples.map((s) => ({ id: s.id, label: s.name })),
      COL_SAMPLE_X
    ),
    ...place(
      "condition",
      "c",
      conditions.map((c) => ({ id: c.id, label: c.name })),
      COL_CONDITION_X
    ),
    ...place("product", "p", products, COL_PRODUCT_X),
  ];
}
