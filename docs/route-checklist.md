# 路由验证清单

本仓库没有测试套件，这份清单就是测试套件。每个 PR 合并进 `feat/site-redesign` 之前走一遍。

## 0. 自动检查（必须全绿）

```bash
corepack pnpm@10 lint      # 注意：默认 corepack 的 pnpm v11 会因 store 不匹配失败，用 pnpm@10
corepack pnpm@10 build
```

`build` 本身能抓到很多问题：MDX 配置错误、`generateStaticParams` 漏项、RSC/客户端边界违规
（客户端组件 import 了 `src/lib/supabase/admin.ts` 会因 `server-only` 直接编译失败）、内容注册表类型错误。

### 基线（2026-08-05，`feat/site-redesign` 起点）

| 命令 | 状态 |
|---|---|
| `build` | ✅ 通过，20 条静态路由 |
| `lint` | ⚠️ 7 errors / 3 warnings —— **全部集中在待删除的两个文件**：`src/app/plasmid/page.tsx`(1)、`src/app/research/page.tsx`(6)。这两个文件删除后 lint 应转绿。 |

> 原始基线是 35 errors / 17 warnings，其中 28 errors 来自 `References/`（外部参考资料，
> tsconfig 已排除但 eslint 没有）。已在 `eslint.config.mjs` 补上 `References/**` 忽略规则。

### 遗留告警（暂不处理）

- `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` ——
  Next 16 要求把 `src/middleware.ts` 改名为 `src/proxy.ts`。等阶段二动 middleware（移除
  `/plasmid`、清理 `/dashboard`、加 `/admin`）时一并处理。

## 1. 路由走查

每条路由都要在 **亮色 + 暗色** × **未登录 + 已登录** 四种组合下确认能正常渲染、无 console 报错。

| 路由 | 期望 |
|---|---|
| `/` | 首页：hero + 给药路线图 + 框架面板 + 工具入口带（见下方第 3 节） |
| `/#lytac-degrader` | 直接访问要自动切到 Disease 站点并展开该课题 |
| `/progress` | 文献进展流（阶段三前显示空态） |
| `/assistant` | 占位页 |
| `/tools` | 入口页，LNP Suite 组排第一 |
| `/tools/lnp-formula` | 三个 tab，见下方专项检查 |
| `/tools/tlnp` | tLNP 工作台，未登录显示页内登录卡片；见下方 2.5 节 |
| `/tools/mol-weight` | 独立页 |
| `/tools/molar-concentration` | 独立页 |
| `/tools/dilution` | 独立页 |
| `/tools/formulation` | 独立页 |
| `/tools/ligation` | 独立页 |
| `/contact` | 反馈表单 |
| `/profile` | 已登录可见，未登录 → `/login` |
| `/login` `/register` `/forgot-password` `/reset-password` | 认证流程 |
| `/admin/research` | 管理员 → 正常 · 已登录非管理员 → **404** · 未登录 → `/login` |
| `/plasmid` | **404**（已移除） |

## 2. LNP 专项回归检查

这几条是真正会坏的地方，任何改动 `src/app/tools/lnp-formula/page.tsx` 或其子组件之后都要重跑。

1. **RiboGreen 状态保持**：在样品网格输入数据 → 切到「单配方计算」→ 切回 RiboGreen，
   **数据必须还在**。（靠 `forceMount` + `hidden` div，见 `page.tsx:398-402`）
2. **筛选登录门**：未登录点「配方筛选」tab → 显示页内登录卡片，不崩、不跳转。
3. **工作流图隐藏**：在 RiboGreen tab 下，页面底部的 `<LnpWorkflow />` 是隐藏的
   （`tab !== "ribogreen"` 判断，`page.tsx:406`）。
4. **导出一致性**（英文化批次 4 之后）：「复制结果」的输出和 Word 导出逐字段一致。
5. **副本后缀**：保存一个配方 → 复制 → 后缀是 `(Copy)`；执行迁移 `006` 后历史记录也变成 `(Copy)`。
6. **中文 PDF 不能坏**：导出一份**配方名含中文**的筛选 PDF，中文必须正常显示。
   `public/fonts/NotoSansSC-*.woff` **不是废弃资源** —— `src/lib/export/lnp-bench-pdf.tsx:23-28`
   注册了它，第 38 行设为页面默认字体。**永久保留这两个字体文件**，因为用户仍可能在配方名里输入中文。

## 2.5 tLNP 工作台专项回归检查

`/tools/tlnp`。改动 `src/components/tools/tlnp/**` 或 `src/lib/calculations/tlnp-*.ts` 之后重跑。

1. **登录门**：未登录访问显示页内登录卡片，不崩、不跳转（`/tools/*` 不受 middleware 保护，
   真正的隔离靠 RLS）。
2. **迁移失败模式**：`004_tlnp_experiment.sql` 未执行时新建批次必须提示
   「请先在 Supabase 执行 004_tlnp_experiment.sql 迁移」，而不是笼统的「操作失败」。
   Supabase 返回的是 Postgres `23514`，`describeError(e, "004_tlnp_experiment.sql")` 负责翻译。
3. **自动保存节流**：填一段讨论文字，看 Network 面板 —— 停止输入约 800 ms 后**只发一次** PATCH。
   每敲一键一次请求说明防抖坏了（`use-tlnp-batch.ts`）。
4. **参数往返**：手输一个新值 →「存为选项」→ 新增一个自定义参数字段 → 刷新页面。
   **值、被提升的选项、自定义字段的标签都必须回来**。这条靠 `ParamEntry` 自带 label/options，
   而不是靠代码侧注册表 —— 坏了的话表现是自定义字段消失或变成「自定义参数」。
5. **损坏数据容忍**：在 Supabase 把某批次 `data` 改成 `{}` 或 `{"prep":{"samples":"nonsense"}}`，
   两次都必须打开成一个空但可用的批次。`parseTlnpExperiment` 永不抛错。
6. **配方一致性**：同一个配方在 `/tools/lnp-formula` 单配方计算和 tLNP 样品里搭出来，
   吸取体积和水相/脂相数字必须逐位一致（两边都走 `computeBenchFormulation`）。
7. **RiboGreen 双向联动**：RiboGreen 标签页「从配方载入样本名」→ 切来源到「tLNP 批次」→ 选样品
   → 填读数保存 → 回到批次，模块 1 表征结果显示「已关联」，导入的四个数与 RiboGreen 表格一致；
   再点样本格里的外链图标 → 落到 `/tools/tlnp?batch=…&m=1`。**同时确认原有筛选会话流程没坏**
   （历史行数据没有 `sourceKind`，按 screening_session 处理）。
8. **画布**：拖样品到反应条件 → 生成连线和产物节点；刷新后位置和连线不变；
   条件→条件的非法连接被拒；删掉一个条件时它的连线和产物级联消失；
   开着画布切暗色，边线/handle/背景/controls 全部跟随（`.tlnp-flow` 把 `--xy-*-default` 映射到我们的 token）。
9. **峰图**：从 Excel 复制三列（体积/A260/A280）粘贴 → 识别出两个通道；同样内容传 CSV → 图完全相同；
   粘贴垃圾 → 不崩且出 warning 提示。缺失读数处曲线**断开**，不能插值连过去。
10. **导出**：批次总览导出 PDF（**用含中文的样品名**，确认 CJK 正常）、Excel、JSON 三种都能出；
    Excel 的「配方」表和 LNP Calculator 的筛选导出是同一个 `buildBenchSheet`，两边必须一致。
11. **PDF 里的峰图**：导入过层析数据的批次，PDF 里必须有**画出来的曲线**（不是表格），
    坐标轴带刻度数字，收集峰段有底色，图例显示峰值。曲线几何和网页图共用
    `buildChromatogramPaths` —— 两边形状不一致就是有人分叉了。
    坐标轴**名称**（体积 / 吸光度）在 Svg 外面渲染：react-pdf 的 SVG 文字层拿不到注册的
    中文字体，刻度数字是 ASCII 才能放进去，别把中文挪进 `<Svg>`。

## 3. 首页给药路线图专项检查

`src/components/research/dose-route.tsx`。几何是写死的 viewBox 坐标，改任何一个数都要重跑这一节。

1. **断点**：视口 1440 / 1280 / 1024 走一遍横向路线 —— 三个站点不能互相重叠、不能压到分叉上，
   `03 · APPLICATION` 那行不能换行（靠 `whitespace-nowrap`）。768 / 390 走竖排版本。
2. **改过 `LEGS[].d` 就必须重新量长度**：控制台跑
   `$$('svg path.route-draw').map(p => p.getTotalLength())`，把结果填回 `len`。
   **偏小会让线尾永远画不出来**（dash 揭示靠的就是这个数）。
3. **载入编排**：整条路线一笔画出 → 三个站点依次落位 → 分叉展开 → 面板上浮，之后**完全静止**。
   要逐帧看的话，`document.getAnimations().forEach(a => a.pause())` 之后手动 seek `currentTime`；
   直接按墙钟时间截图是不准的，dev server 会在 hydration 之后才注入样式表。
   历史 bug：`.route-draw` 用 `forwards` 而不是 `both` 时，带 delay 的后两段会在等待期间**满格显示**。
4. **减少动态效果**：系统开启后刷新，页面直接是终态，`stroke-dasharray` 计算值为 `none`。
5. **面板不跳**：在两课题（LNP）和四课题（Disease）之间来回悬停，面板下方的内容不能上下窜动。
   `md:min-h-[17.25rem]` 是按实测最高的方向（274px）定的，课题数变化时要重新量。
6. **分叉联动**：悬停 03 后展开某个疾病课题，对应的那条分叉加粗、其余三条淡出。
7. **键盘**：Tab 能依次走到三个站点，焦点环可见，面板跟着切换。

## 4. 配色与语言残留检查

硬编码调色板（class 字符串没法用 lint 规则可靠捕获）。**当前结果应为零**，扫描已在 2026-08-06 做完：

```bash
grep -rnoE '\b(text|bg|border|from|to|via|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]{2,3}' src/components src/app
```

新代码要按**语义**选 token，不是按颜色像什么。两类不能混：

| 语义 | Token | 例子 |
|---|---|---|
| 通过 / 有效 / 结果高亮 | `success` `success-subtle` `success-foreground` | 摩尔比合计 = 100%、校正已应用 |
| 超范围 / 需要注意 | `warning` …-subtle …-foreground | 读数超出标准曲线量程 |
| 提示 / 补充说明 | `info` …-subtle …-foreground | 「以上计算基于…」这类说明块 |
| 错误 / 阻断 | `destructive`（shadcn 自带） | 摩尔比总和必须为 100% |
| **分类**（不是状态） | `pillar-lnp`（脂相）· `pillar-utr`（水相）· `pillar-disease` · `accent-utility` · `chart-1..5` | 工作流四个步骤、水相/脂相圆点、连接反应里的 Vector/Insert/Enzyme 行 |

最后一行是关键：**分类用途绝不能借用状态色**。琥珀色一旦同时表示「超量程」和「脂相」，
这两个含义在同一个页面里就都失效了。`--pillar-lnp` = 有机相 / `--pillar-utr` = 水相
这层对应关系在 `globals.css` 里就是这么定义的，照着用。

`-subtle` 系列自带明暗两套值，所以**不要再写 `dark:` 变体** —— 写了就是把暗色模式重新写死一遍。

中文残留（注释里有中文没问题，**字符串字面量里不行**）：

```bash
grep -rlP '[\p{Han}]' src/ --include='*.tsx' --include='*.ts'
```

## 5. 主题一致性

任何改动 `src/app/globals.css` 之后，重点看这两个「金丝雀」页面在亮/暗两种模式下的表格对齐与可读性：

- `src/components/tools/ribogreen/sample-grid.tsx`（96 列样品网格）
- `src/components/tools/lnp/formulation-workspace.tsx`（配方工作区）
- `src/components/tools/tlnp/conjugation-flow.tsx`（偶联画布 —— 第三方组件里唯一吃我们 token 的地方）

另外确认 `src/components/tools/ribogreen/scatter-fit-chart.tsx` 的散点与拟合线颜色在明暗模式下
**色相一致**（历史 bug：`--chart-1` 亮色是橙、暗色是蓝紫）。同一条规则适用于
`chromatogram-chart.tsx` 的多通道曲线：一条峰不能因为切了主题就换个颜色身份。
