import type { ComponentType } from "react";
import type { DiagramProps } from "./primitives";
import { LnpCrossSection } from "./lnp-cross-section";
import { MrnaConstruct } from "./mrna-construct";
import { DiseaseProgrammes } from "./disease-programmes";

/**
 * String-keyed registry.
 *
 * Content metadata references a diagram by id (`diagram: "lnp-cross-section"`)
 * rather than importing the component, which keeps topic metadata serialisable
 * and stops the homepage pulling every diagram into one module.
 */
export const DIAGRAMS = {
  "lnp-cross-section": LnpCrossSection,
  "mrna-construct": MrnaConstruct,
  "disease-programmes": DiseaseProgrammes,
} satisfies Record<string, ComponentType<DiagramProps>>;

export type DiagramId = keyof typeof DIAGRAMS;

export { LnpCrossSection, MrnaConstruct, DiseaseProgrammes };
export type { DiagramProps };
