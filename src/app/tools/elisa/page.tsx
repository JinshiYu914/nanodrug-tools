import ElisaWorkbench from "@/components/tools/elisa/elisa-workbench";

export const metadata = {
  title: "ELISA计算",
  description: "8 点 ELISA 标准曲线拟合、96 孔板 OD450 导入与样本浓度计算。",
};

export default function ElisaPage() {
  return <ElisaWorkbench />;
}
