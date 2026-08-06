/**
 * Lab Tools shell.
 *
 * The only job right now is `quiet` — it strips the heavy ink outlines and
 * hard offset shadows from the Bench Sketch system for everything under
 * /tools/*, because dense calculator grids are unreadable wearing them.
 * See the `.quiet` block in src/app/globals.css.
 *
 * The sticky tool sub-nav lands here in phase 2.
 */
export default function ToolsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="quiet">{children}</div>;
}
