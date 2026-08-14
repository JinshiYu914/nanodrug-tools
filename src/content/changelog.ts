/** User-facing release history, newest first. */

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD, the day the release landed on main. */
  date: string;
  title: string;
  summary: string;
  /** Only keep the few details a returning user needs to know. */
  highlights?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.2.0",
    date: "2026-08-14",
    title: "课题协作与层析数据导入",
    summary: "新增课题共享空间，并完善 LNP–RNA 实验数据的协作与记录。",
    highlights: [
      "My Projects 支持创建或加入课题、成员权限和操作记录。",
      "LNP Calculator、RiboGreen 和 tLNP 可在个人与课题数据间切换。",
      "tLNP 层析图支持 Excel / CSV、Fraction Mark 和 min / mL / CV 坐标。",
      "更新首页工具入口、开发中页面和 Contact 反馈存储。",
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-08-12",
    title: "同步保护与访客示例",
    summary: "tLNP 支持访客示例、离线草稿和多设备同步保护。",
    highlights: [
      "云端版本冲突会保留副本，避免覆盖较新的实验记录。",
      "抗体来源和表达信息同步进入记录与导出。",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-08-12",
    title: "IVT mRNA 工作台",
    summary: "按批次记录 IVT 实验，并自动建立可筛选的 RNA 库。",
    highlights: [
      "支持线性化、IVT、纯化、方法模板和实验结果记录。",
      "RNA 库可检索并导出完整批次信息。",
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-08-07",
    title: "tLNP 制备工作台",
    summary: "记录配方设计、偶联、纯化和体内外实验的完整流程。",
    highlights: [
      "打通 RiboGreen 计算、抗体库和纯化预设。",
      "支持层析峰图、实验图表、整批导出和批次对比。",
    ],
  },
  {
    version: "v0.8.0",
    date: "2026-08-06",
    title: "配方与 RiboGreen 联动",
    summary: "配方筛选和 RiboGreen 可双向跳转，并保存制备方法。",
  },
  {
    version: "v0.7.0",
    date: "2026-08-06",
    title: "首页与视觉更新",
    summary: "更新首页研究叙事，并统一全站深浅色视觉系统。",
  },
  {
    version: "v0.6.0",
    date: "2026-07-28",
    title: "RiboGreen 计算器",
    summary: "新增标准曲线、批量样本计算和实验记录。",
  },
  {
    version: "v0.5.1",
    date: "2026-07-19",
    title: "Excel 导出优化",
    summary: "筛选实验台导出改为更适合实验记录的分区布局。",
  },
  {
    version: "v0.5.0",
    date: "2026-07-09",
    title: "按 RNA 用量计算 Lipid Mix",
    summary: "根据 RNA 用量和 N/P 比自动计算脂相体积。",
  },
  {
    version: "v0.4.0",
    date: "2026-06-16",
    title: "配方导出",
    summary: "支持 Word 导出和选择性导出配方。",
  },
  {
    version: "v0.3.0",
    date: "2026-04-20",
    title: "批量配方筛选",
    summary: "新增多配方筛选实验台和 PDF / Excel 导出。",
  },
  {
    version: "v0.2.0",
    date: "2026-02-27",
    title: "账户体系",
    summary: "新增登录、注册、找回密码、个人中心和联系页面。",
  },
  {
    version: "v0.1.0",
    date: "2026-02-25",
    title: "网站上线",
    summary: "上线首批实验计算器并接入 Supabase 认证。",
  },
];
