import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LNP 配方计算",
  description: "LNP 脂质配方、制备体系与 RiboGreen 包封率/浓度计算。",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
