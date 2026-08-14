/**
 * Site chrome copy and the tool registry.
 *
 * Kept out of the components so the nav, the mobile drawer, the Lab Tools hub
 * and the tools sub-nav all read one list — adding a calculator means editing
 * here, not in four places.
 */

export const SITE_NAME = "LNP Partner";
export const SITE_TAGLINE =
  "Lipid nanoparticle delivery, mRNA UTR engineering, and the diseases they reach.";

export type NavLink = {
  href: string;
  label: string;
};

/** Top-level navigation. Lab Tools renders as a dropdown, not a plain link. */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/progress", label: "Research Updates" },
  { href: "/assistant", label: "AI Assistant" },
  { href: "/tools", label: "Lab Tools" },
];

export type ToolEntry = {
  href: string;
  label: string;
  /** One line, sentence case, says what it does — not what it is. */
  blurb: string;
};

export type ToolGroup = {
  id: string;
  label: string;
  tools: ToolEntry[];
};

/**
 * LNP suite first, deliberately — it is the flagship and the reason most
 * people arrive. General calculators follow.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "lnp",
    label: "LNP suite",
    tools: [
      {
        href: "/tools/lnp-formula",
        label: "LNP Calculator",
        blurb: "Formulation, batch screening, RiboGreen EE.",
      },
      {
        href: "/tools/tlnp",
        label: "tLNP Workbench",
        blurb: "Record a targeted-LNP batch end to end, then compare batches.",
      },
      {
        href: "/tools/ivt",
        label: "IVT mRNA Workbench",
        blurb:
          "Record IVT batches and maintain a searchable RNA library.",
      },
    ],
  },
  {
    id: "general",
    label: "General calculators",
    tools: [
      {
        href: "/tools/mol-weight",
        label: "Molecular Weight",
        blurb: "Formula to MW, with element breakdown.",
      },
      {
        href: "/tools/molar-concentration",
        label: "Molar Concentration",
        blurb: "Mass, concentration, volume — solve for any one.",
      },
      {
        href: "/tools/dilution",
        label: "Dilution",
        blurb: "C₁V₁ = C₂V₂, plus serial ladders.",
      },
      {
        href: "/tools/formulation",
        label: "In-Vivo Formulation",
        blurb: "mg/kg dose to vehicle volumes.",
      },
      {
        href: "/tools/ligation",
        label: "Ligation",
        blurb: "Vector:insert ratios and reaction volumes.",
      },
    ],
  },
];

/** Flat list, LNP first — used by the tools sub-nav. */
export const ALL_TOOLS: ToolEntry[] = TOOL_GROUPS.flatMap((g) => g.tools);

export const FOOTER_LINKS: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Research",
    links: [
      { href: "/#research", label: "Research interests" },
      { href: "/progress", label: "Research updates" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { href: "/tools", label: "Lab Tools" },
      { href: "/tools/lnp-formula", label: "LNP Calculator" },
      { href: "/tools/tlnp", label: "tLNP Workbench" },
      { href: "/tools/ivt", label: "IVT mRNA Workbench" },
      { href: "/assistant", label: "AI Assistant" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/changelog", label: "Changelog" },
      { href: "/login", label: "Sign in" },
    ],
  },
];
