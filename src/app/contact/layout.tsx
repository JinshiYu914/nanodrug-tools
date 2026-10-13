import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "反馈与联系",
  description: "提交工具建议、Bug 反馈或功能改进意见。",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
