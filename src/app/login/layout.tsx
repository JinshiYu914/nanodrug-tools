import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登录",
  robots: { index: false },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
