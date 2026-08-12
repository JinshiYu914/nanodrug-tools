import {
  createInVitroColumn,
  createObservationRow,
  createProteinEntry,
  createRoiRun,
  createSystemCharacterization,
  createTlnpSample,
  emptyTlnpExperiment,
  systemFromSample,
  type RoiRow,
  type TlnpExperimentData,
} from "./tlnp-experiment";
import type { ParamEntry } from "./tlnp-params";

const setParam = (params: ParamEntry[], id: string, value: string) =>
  params.map((entry) => (entry.id === id ? { ...entry, value } : entry));

/** A fictional, internally consistent dataset used only for the guest tour. */
export function createTlnpDemoExperiment(): TlnpExperimentData {
  const data = emptyTlnpExperiment();
  data.meta = {
    batchCode: "DEMO-CD3-001",
    experimentDate: "2026-08-01",
    operator: "Demo User",
    objective: "体验 anti-CD3 tLNP 从制备、偶联、纯化到体内外评价的完整记录流程",
  };

  data.prep.design.date = "2026-08-01";
  data.prep.design.params = setParam(data.prep.design.params, "cationicLipid", "MC3");
  data.prep.design.params = setParam(data.prep.design.params, "linker", "DSPE-PEG2k-mal");
  data.prep.design.params = setParam(data.prep.design.params, "cargo", "mRNA");
  data.prep.design.params = setParam(data.prep.design.params, "mixing", "NanoAssemblr");
  data.prep.design.params = setParam(data.prep.design.params, "operator", "Demo User");
  data.prep.design.note = "示例数据：微流控混合后使用 PBS pH 7.4 置换缓冲液。";

  const sample = createTlnpSample(null, "CD3-LNP-demo");
  sample.prep = { ...sample.prep, rnaMass: "10", rnaConc: "1", npRatio: "6" };
  sample.ee.manual = {
    conc_ng_uL: "182.4",
    volume_uL: "48",
    ee_percent: "91.6",
    yield_percent: "87.5",
  };
  sample.dls = {
    size_nm: "83.7",
    pdi: "0.142",
    zeta_mV: "-3.8",
    instrument: "Demo DLS",
    note: "三次测量的示例汇总值",
  };
  sample.tem = "yes";
  sample.resultNote = "颗粒分布均一；所有数值均为虚构示例。";
  data.prep.samples = [sample];
  data.prep.results.discussion = "示例批次粒径与包封率处于预期展示范围。";

  const protein = {
    ...createProteinEntry(0),
    name: "anti-CD3 scFv (demo)",
    mw: "50000",
    conc: "1.2",
    concUnit: "mg_per_mL" as const,
    source: "自表达",
    expressionSystem: "293F",
    expressionDate: "2026-07-29",
    note: "虚构示例；Protein A 纯化，非真实实验材料。",
  };
  const system = {
    ...systemFromSample(sample, 0),
    name: "CD3-tLNP-demo",
    proteinId: protein.id,
    rnaMass: "5",
    molarRatio: "1",
    temperature: "室温",
    duration: "2 h",
    shaking: "轻柔混匀",
    totalVolume: "100",
    reactionBuffer: "PBS pH 7.4",
    note: "示例加样体系，可任意修改体验计算。",
  };
  const observation = {
    ...createObservationRow(system.id),
    turbidity: "clear" as const,
    precipitate: "none" as const,
    note: "反应后澄清，无可见沉淀（虚构示例）。",
  };
  data.conjugation = {
    design: { date: "2026-08-02" },
    proteins: [protein],
    systems: [system],
    results: { observations: [observation], discussion: "偶联体系外观稳定。" },
  };

  const purified = createSystemCharacterization(system.id);
  purified.ee.manual = {
    conc_ng_uL: "146.2",
    volume_uL: "42",
    ee_percent: "90.8",
    yield_percent: "70.1",
  };
  purified.dls = {
    size_nm: "91.3",
    pdi: "0.168",
    zeta_mV: "-4.2",
    instrument: "Demo DLS",
    note: "纯化后虚构示例值",
  };
  purified.tem = "yes";
  purified.note = "主峰组分合并后浓缩。";
  data.purification.design = {
    ...data.purification.design,
    date: "2026-08-02",
    method: "cl4b",
    cl4b: {
      columnLength: "30",
      columnDiameter: "1.5",
      flowRate: "0.5",
      buffer: "PBS pH 7.4",
      ultrafiltrationConcentrate: true,
      note: "示例柱参数",
    },
    operator: "Demo User",
    note: "收集第一主峰，随后超滤浓缩。",
  };
  data.purification.chromatograms = [
    {
      id: "demo-chromatogram",
      name: "CL-4B demo run",
      xLabel: "洗脱体积 (mL)",
      channels: [
        { id: "demo-a280", label: "A280", slot: 1 },
        { id: "demo-a260", label: "A260", slot: 2 },
      ],
      points: [
        { x: 0, y: [0.02, 0.01] },
        { x: 2, y: [0.08, 0.06] },
        { x: 4, y: [0.46, 0.38] },
        { x: 6, y: [0.92, 0.78] },
        { x: 8, y: [0.41, 0.32] },
        { x: 10, y: [0.12, 0.08] },
        { x: 14, y: [0.36, 0.05] },
        { x: 18, y: [0.04, 0.02] },
      ],
      fractions: [{ id: "demo-fraction", from: 4, to: 9, label: "tLNP 主峰" }],
      source: "paste",
      sourceName: "虚构示例数据",
      rawText: "0\t0.02\t0.01\n2\t0.08\t0.06\n4\t0.46\t0.38\n6\t0.92\t0.78\n8\t0.41\t0.32\n10\t0.12\t0.08\n14\t0.36\t0.05\n18\t0.04\t0.02",
      note: "第一峰为示例 tLNP，第二峰表示游离抗体。",
    },
  ];
  data.purification.results = {
    systems: [purified],
    discussion: "示例层析分离良好，纯化后粒径轻微增加。",
  };

  data.assay.active = "invitro";
  data.assay.invitro.design.date = "2026-08-04";
  data.assay.invitro.design.params = setParam(data.assay.invitro.design.params, "cellLine", "人 T cell");
  data.assay.invitro.design.params = setParam(data.assay.invitro.design.params, "readout", "Luciferase");
  data.assay.invitro.design.params = setParam(data.assay.invitro.design.params, "dose", "100 ng");
  data.assay.invitro.design.params = setParam(data.assay.invitro.design.params, "timepoint", "24 h");
  const columns = [createInVitroColumn("Untargeted LNP"), createInVitroColumn("CD3-tLNP")];
  data.assay.invitro.results = {
    readout: "luciferase",
    fluorMetric: "mfi",
    columns,
    replicates: [
      { id: "demo-rep-1", values: ["12400", "38600"] },
      { id: "demo-rep-2", values: ["13100", "40200"] },
      { id: "demo-rep-3", values: ["11950", "37700"] },
    ],
    discussion: "虚构示例中，靶向组读数高于非靶向组；不代表真实疗效。",
  };

  data.assay.invivo.design.date = "2026-08-06";
  data.assay.invivo.design.params = setParam(data.assay.invivo.design.params, "strain", "NSG");
  data.assay.invivo.design.params = setParam(data.assay.invivo.design.params, "route", "尾静脉 (i.v.)");
  data.assay.invivo.design.params = setParam(data.assay.invivo.design.params, "timepoint", "6 h");
  const roiRows: RoiRow[] = [
    { id: "demo-roi-1", sample: "Untargeted LNP", organ: "Liver", totalRoi: "820000", avgRoi: "41000" },
    { id: "demo-roi-2", sample: "Untargeted LNP", organ: "Spleen", totalRoi: "210000", avgRoi: "18000" },
    { id: "demo-roi-3", sample: "CD3-tLNP", organ: "Liver", totalRoi: "510000", avgRoi: "27000" },
    { id: "demo-roi-4", sample: "CD3-tLNP", organ: "Spleen", totalRoi: "360000", avgRoi: "29000" },
  ];
  data.assay.invivo.results = {
    runs: [createRoiRun("6 h ex vivo（示例）", "", roiRows)],
    discussion: "虚构 ROI 数据仅用于体验粘贴、统计与作图。",
  };

  return data;
}
