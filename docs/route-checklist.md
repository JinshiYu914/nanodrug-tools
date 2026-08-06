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

硬编码调色板（class 字符串没法用 lint 规则可靠捕获），结果应接近于零：

```bash
grep -rnoE '\b(text|bg|border|from|to|via|ring)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}' src/components src/app
```

中文残留（注释里有中文没问题，**字符串字面量里不行**）：

```bash
grep -rlP '[\p{Han}]' src/ --include='*.tsx' --include='*.ts'
```

## 5. 主题一致性

任何改动 `src/app/globals.css` 之后，重点看这两个「金丝雀」页面在亮/暗两种模式下的表格对齐与可读性：

- `src/components/tools/ribogreen/sample-grid.tsx`（96 列样品网格）
- `src/components/tools/lnp/formulation-workspace.tsx`（配方工作区）

另外确认 `src/components/tools/ribogreen/scatter-fit-chart.tsx` 的散点与拟合线颜色在明暗模式下
**色相一致**（历史 bug：`--chart-1` 亮色是橙、暗色是蓝紫）。
