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
  { href: "/progress", label: "Research Progress" },
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
        blurb:
          "Size a formulation from N/P ratio and lipid molar ratios, screen batches side by side, and work up RiboGreen encapsulation efficiency.",
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
        blurb: "Parse a chemical formula into a molecular weight and a per-element breakdown.",
      },
      {
        href: "/tools/molar-concentration",
        label: "Molar Concentration",
        blurb: "Solve for mass, concentration, volume or molecular weight from the other three.",
      },
      {
        href: "/tools/dilution",
        label: "Dilution",
        blurb: "C₁V₁ = C₂V₂, plus serial dilution ladders.",
      },
      {
        href: "/tools/formulation",
        label: "In-Vivo Formulation",
        blurb: "Turn a mg/kg dose and an animal count into DMSO, PEG300, Tween-80 and water volumes.",
      },
      {
        href: "/tools/ligation",
        label: "Ligation",
        blurb: "Vector-to-insert molar ratios, per-fragment volumes, enzymes and water.",
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
      { href: "/", label: "Research interests" },
      { href: "/research", label: "All topics" },
      { href: "/progress", label: "Weekly progress" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { href: "/tools", label: "Lab Tools" },
      { href: "/tools/lnp-formula", label: "LNP Calculator" },
      { href: "/assistant", label: "AI Assistant" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Sign in" },
    ],
  },
];
