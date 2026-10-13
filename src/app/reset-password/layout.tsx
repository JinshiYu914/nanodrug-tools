import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "重设密码",
  robots: { index: false },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
