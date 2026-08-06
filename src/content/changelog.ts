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
