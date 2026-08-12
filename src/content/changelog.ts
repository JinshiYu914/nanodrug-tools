/**
 * Release history, newest first.
 *
 * One entry per shipped milestone, not per commit — the point is to let a
 * returning user see what changed since they last used the site. Dates are
 * the day the work landed on `main`. When you ship something user-visible,
 * add an entry here in the same PR.
 */

export type ChangeKind = "feature" | "improvement" | "fix" | "design";

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  feature: "新增",
  improvement: "改进",
  fix: "修复",
  design: "设计",
};

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD, the day it went live. */
  date: string;
  title: string;
  /** One sentence on why the release exists. */
  summary?: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    date: "2026-08-12",
    title: "IVT mRNA 工作台与 RNA 库",
    summary:
      "从质粒线性化到表达验证，按批次记录多条 RNA；常用方法可保存为模板，全部 RNA 自动汇入个人 RNA 库。",
    changes: [
      {
        kind: "feature",
        text: "新增 IVT mRNA 工作台（需登录）：批次支持新建、复制、重命名、文件夹整理和自动保存，一个批次可记录多条 RNA，并可把实验方法复制到其他 RNA。",
      },
      {
        kind: "feature",
        text: "RNA 选择提供常用 RNA 与 T7 质粒载体，可自定义；样本序号默认按日期自动生成。",
      },
      {
        kind: "feature",
        text: "质粒线性化默认使用 50 µL 固定体系：输入 DNA 浓度和质量后自动计算加样体积与补水量，体系数可直接在列标题中调整并自动换算总用量。",
      },
      {
        kind: "feature",
        text: "IVT 反应提供 20 µL 默认加样体系，记录试剂盒、核苷修饰与加帽方式；A / U / G / C / Cap / Buffer / T7 Enzyme、模板 DNA 和水均可按体系数自动换算。",
      },
      {
        kind: "feature",
        text: "线性化、IVT 与 RNA 纯化方法均可保存为个人模板并在其他批次直接调用；模板以快照写入批次，不会因后续修改而改写历史记录。",
      },
      {
        kind: "feature",
        text: "新增个人 RNA 库：自动汇总所有 IVT 批次，支持按名称、RNA、载体、日期和状态筛选，并可导出包含完整方法、得量和表达验证的 Excel。",
      },
      {
        kind: "improvement",
        text: "RNA 浓度与终体积自动换算总得量；旧版或异常批次数据采用兼容解析，避免因缺失字段导致页面崩溃。",
      },
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-08-07",
    title: "tLNP 制备工作台",
    summary:
      "按批次记录靶向 LNP 的完整链路：LNP 制备 → 偶联反应 → LNP 纯化 → 体内外实验。每一步都分实验设计与实验结果，可随时导出、跨批次对比。",
    changes: [
      {
        kind: "feature",
        text: "新增 tLNP 制备工作台（需登录）：一个批次记录一次完整实验，四个模块各自记录日期与操作人，左侧可用文件夹整理批次。",
      },
      {
        kind: "feature",
        text: "LNP 制备：多样品配方表一行一个样品，配方直接复用 LNP Calculator 的算法与 PDF / Excel 导出；表征结果改成矩阵，一行一个样品，包含 RiboGreen 浓度 / 体积 / 包封率 / 得率、DLS 粒径 / PDI / Zeta、是否有 TEM 与备注。",
      },
      {
        kind: "feature",
        text: "与 RiboGreen 打通：点「输入酶标仪检测结果开始计算」跳到 RiboGreen 标签页，样本名已按批次填好，测完点「导入结果并返回」把数值带回工作台。工作台不另做一份计算器，两边永远是同一套算法。",
      },
      {
        kind: "feature",
        text: "偶联反应：抗体信息可存进抗体库供所有批次调用；反应体系写成矩阵，一列一个体系（LNP 浓度、投料 LNP-RNA 量、linker 比例），一行一项反应条件；加样体系每个体系单独算，并附上从投料量到抗体体积的完整计算过程。摩尔比按 linker（如 DSPE-PEG2k-mal）: 抗体 计算。",
      },
      {
        kind: "feature",
        text: "LNP 纯化：CL-4B 的柱长 / 柱径 / 流速 / buffer 可存为预设供所有批次调用；层析数据复制粘贴即出峰图，通道显示为 A280 / A260，可标注收集峰段并重新编辑原始数据。",
      },
      {
        kind: "feature",
        text: "体内外实验：体外结果一列一个样本、一行一次重复，可直接从 Excel 粘贴与复制，自动生成均值 ± SD 柱状图，支持 Luciferase 与荧光蛋白（MFI / 阳性率）两种定量；体内成像结果可建多组分别命名，粘贴 样本名 / 器官 / Total ROI / Avg ROI 四列后自动出 Total ROI、Avg ROI 与肝脾占比三张图。",
      },
      {
        kind: "feature",
        text: "总览与导出：整批次 PDF（含画出来的层析峰图）、十一张表的 Excel、以及无损的 JSON；另可同时对比最多四个批次的关键设计与结果。",
      },
    ],
  },
  {
    version: "v0.8.0",
    date: "2026-08-06",
    title: "LNP Calculator：配方与包封率打通",
    summary:
      "配方筛选和 RiboGreen 之间可以互相跳转，样本参数支持批量填写，制备方法随配方一起存档。",
    changes: [
      {
        kind: "feature",
        text: "RiboGreen 样本名可从配方筛选实验台一键载入，并与该配方建立链接；样本列和实验台之间可双向跳转。",
      },
      {
        kind: "feature",
        text: "稀释倍数、LNP 体积、投入 RNA 量、需取用 LNP-RNA 支持批量修改（全部 / 仅空白 / 指定样本），单个样本仍可单独填写。",
      },
      {
        kind: "feature",
        text: "配方筛选加入实验方法记录：制备方法（微流控 / 涡旋 / 吹打）与后处理（透析 1–4 h 或自定义、超滤 1–3 次或仅浓缩），并写入 PDF / Excel 导出。",
      },
      {
        kind: "improvement",
        text: "RiboGreen「结果可能不准确」提示按问题归并成一行，不再每个样本占一行。",
      },
      { kind: "feature", text: "新增本页：站点更新日志。" },
    ],
  },
  {
    version: "v0.7.0",
    date: "2026-08-06",
    title: "Bench Sketch 设计系统与新首页",
    changes: [
      {
        kind: "design",
        text: "引入 Bench Sketch 设计令牌系统，站点外壳、首页与研究页整体重做。",
      },
      {
        kind: "design",
        text: "首页改为「一剂药走过的路线」示意图，主题卡片默认展开。",
      },
      { kind: "improvement", text: "计算器全面改用语义色彩令牌，深浅色一致。" },
    ],
  },
  {
    version: "v0.6.0",
    date: "2026-07-28",
    title: "RiboGreen 包封率计算器",
    changes: [
      {
        kind: "feature",
        text: "新增 RiboGreen 标签页：标准曲线拟合、批量样本计算、标准品校正、实验记录按年月归档。",
      },
      { kind: "fix", text: "全站共用一个 Supabase 客户端，修复偶发的登录态丢失。" },
      { kind: "fix", text: "导出的脂相浓度改为用户填写值，不再是推导值。" },
    ],
  },
  {
    version: "v0.5.1",
    date: "2026-07-19",
    title: "实验台 Excel 导出重排",
    changes: [
      {
        kind: "improvement",
        text: "筛选实验台的 Excel 导出改为与纸质工作表一致的分区表头布局。",
      },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-07-09",
    title: "按 RNA 用量反推 Lipid Mix",
    changes: [
      {
        kind: "feature",
        text: "Lipid Mix 体积可由 RNA 制备量、N/P 比自动推导，另可多配 100 µL 脂相填充微流控死体积。",
      },
      { kind: "improvement", text: "每日定时任务保持 Supabase 实例不休眠。" },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-06-16",
    title: "Word 导出与选择性导出",
    changes: [
      { kind: "feature", text: "单配方计算结果可导出 Word。" },
      { kind: "feature", text: "实验台支持只导出勾选的配方。" },
      { kind: "fix", text: "修复复制计算结果的内容缺项。" },
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-04-20",
    title: "LNP 配方筛选（批量）",
    changes: [
      {
        kind: "feature",
        text: "新增筛选会话与实验台：一个会话内可加入多个配方，支持拖动排序、重命名、复制。",
      },
      { kind: "feature", text: "实验台可一键导出 PDF 与 Excel。" },
      {
        kind: "improvement",
        text: "配方编辑区抽成共用工作区，单配方与批量筛选共享同一套计算。",
      },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-02-27",
    title: "账户体系",
    changes: [
      { kind: "feature", text: "新增登录、注册、找回密码、个人中心与联系页面。" },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-02-25",
    title: "网站上线",
    summary: "Next.js + Supabase 站点骨架，以及第一批常用计算器。",
    changes: [
      {
        kind: "feature",
        text: "上线分子量、摩尔浓度、稀释、体内配方、连接反应五个计算器，合并进单页标签结构。",
      },
      { kind: "feature", text: "接入 Supabase 认证与研究内容页面。" },
    ],
  },
];
