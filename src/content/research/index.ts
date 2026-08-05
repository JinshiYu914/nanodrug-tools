import type { Pillar, PillarId } from "./types";

/**
 * The research programme, as data.
 *
 * Adding a topic is one object here. In phase 2 each topic also gains a `body`
 * pointing at an MDX file under this directory; the metadata shape below does
 * not change when that lands.
 */
export const PILLARS: Pillar[] = [
  {
    id: "lipid-nanoparticle",
    title: "Lipid nanoparticles",
    shortTitle: "LNP",
    diagram: "lnp-cross-section",
    accent: "lnp",
    question:
      "How do you get a particle to a cell that is not a hepatocyte, and get more protein out of it once you are there?",
    intro:
      "Over ninety percent of an intravenous LNP dose ends up in the liver, because serum ApoE adsorbs to the particle and hands it to hepatocyte LDL receptors. That accident of biology built the field — Onpattro and every hepatic protein-replacement programme depend on it — and it is now the ceiling. This programme works on both the address and the yield: putting a ligand on the surface that overrides the default, and asking what a fifth component can do that the canonical four cannot.",
    topics: [
      {
        slug: "antibody-targeting",
        title: "Antibody-mediated active targeting",
        tagline: "Overriding the ApoE default with a conjugated ligand",
        summary:
          "Conjugating antibodies to the LNP surface to reach cells the passive biodistribution never sees. The prize is in vivo CAR-T: generating engineered T cells inside the patient and skipping ex vivo manufacture entirely.",
        keywords: ["ApoE", "in vivo CAR-T", "surface conjugation", "receptor-mediated uptake"],
        status: "active",
        updatedAt: "2026-08-05",
      },
      {
        slug: "fifth-component",
        title: "Fifth-component optimisation",
        tagline: "Beyond ionizable, helper, cholesterol and PEG",
        summary:
          "The canonical four-lipid formulation is a local optimum found by screening, not a law. Adding a fifth species to modulate endosomal escape and intracellular trafficking to raise protein output per particle.",
        keywords: ["endosomal escape", "helper lipid", "expression yield", "formulation screening"],
        status: "active",
        updatedAt: "2026-08-05",
      },
    ],
  },
  {
    id: "mrna-utr",
    title: "mRNA UTR engineering",
    shortTitle: "mRNA UTR",
    diagram: "mrna-construct",
    accent: "utr",
    question:
      "If the particle decides which organ, can the sequence decide which cell?",
    intro:
      "Delivery and expression are usually treated as one problem, solved by the carrier. They are not. The untranslated regions flanking the coding sequence set ribosome loading, transcript half-life, and — through the miRNA and RNA-binding-protein landscape of each cell type — whether a transcript is translated at all in a given cell. Holding the CDS fixed and rewriting the ends gives a second, orthogonal layer of control that costs nothing in formulation.",
    topics: [
      {
        slug: "cell-specific-utr",
        title: "Cell-type-specific expression",
        tagline: "Reading the miRNA landscape to gate translation",
        summary:
          "Designing UTRs that are translated in the intended cell type and silenced everywhere else, using endogenous miRNA target sites and RBP motifs as the switch rather than the carrier.",
        keywords: ["miRNA target sites", "detargeting", "RBP motifs", "translational control"],
        status: "active",
        updatedAt: "2026-08-05",
      },
      {
        slug: "spleen-targeting",
        title: "Spleen-directed expression",
        tagline: "Reaching immune cells without a new lipid",
        summary:
          "The spleen is where the immune cells that matter for vaccines and cell therapy live. Pairing UTR design with formulation-side tropism to concentrate expression there instead of in hepatocytes.",
        keywords: ["SORT", "splenic tropism", "antigen-presenting cells", "biodistribution"],
        status: "active",
        updatedAt: "2026-08-05",
      },
      {
        slug: "utr-model",
        title: "Predictive UTR models",
        tagline: "From screening libraries to designing them",
        summary:
          "High-throughput UTR screens produce far more sequence–expression data than anyone reads. Training models that predict expression from sequence, so the next library is designed rather than sampled.",
        keywords: ["sequence-to-expression", "MPRA", "model-guided design", "high-throughput screening"],
        status: "planned",
        updatedAt: "2026-08-05",
      },
    ],
  },
  {
    id: "disease",
    title: "Disease programmes",
    shortTitle: "Disease",
    diagram: "disease-programmes",
    accent: "disease",
    question:
      "Which diseases become tractable once you can choose both the cell and the message?",
    intro:
      "Targeting and sequence design are means, not ends. These four areas are where a solved delivery problem changes what is clinically possible — each one currently blocked less by biology than by the inability to put the right transcript in the right cell at a tolerable dose.",
    topics: [
      {
        slug: "protein-degradation",
        title: "Targeted protein degradation",
        tagline: "Encoding the degrader instead of dosing it",
        summary:
          "Delivering mRNA that encodes degradation machinery rather than administering a small-molecule degrader, which puts previously undruggable intracellular targets within reach.",
        keywords: ["undruggable targets", "E3 ligase", "intracellular targets", "degrader"],
        status: "planned",
        updatedAt: "2026-08-05",
      },
      {
        slug: "tumor-immunotherapy",
        title: "Tumour immunotherapy",
        tagline: "Neoantigen vaccines and in vivo cell engineering",
        summary:
          "Personalised neoantigen mRNA has already shown it can cut recurrence alongside checkpoint blockade. The open question is doing the same work in cells that are not in the liver.",
        keywords: ["neoantigen", "checkpoint blockade", "in vivo CAR-T", "antigen presentation"],
        status: "planned",
        updatedAt: "2026-08-05",
      },
      {
        slug: "gene-editing",
        title: "Gene editing therapy",
        tagline: "One dose, transient editor, permanent edit",
        summary:
          "LNP-delivered editors are transient by construction, which removes the integration risk that shadows viral vectors. Editing outside the liver is the frontier.",
        keywords: ["CRISPR", "transient expression", "in vivo editing", "off-target"],
        status: "planned",
        updatedAt: "2026-08-05",
      },
      {
        slug: "cell-therapy",
        title: "Cell therapy",
        tagline: "Removing the ex vivo step",
        summary:
          "Ex vivo cell manufacture is what makes engineered cell therapy expensive and slow. Reprogramming the cells where they already are collapses that entire process into an infusion.",
        keywords: ["ex vivo manufacture", "in vivo reprogramming", "T cells", "HSC"],
        status: "planned",
        updatedAt: "2026-08-05",
      },
    ],
  },
];

export function getPillar(id: string): Pillar | undefined {
  return PILLARS.find((pillar) => pillar.id === id);
}

export function getTopic(pillarId: string, topicSlug: string) {
  const pillar = getPillar(pillarId);
  const topic = pillar?.topics.find((t) => t.slug === topicSlug);
  return pillar && topic ? { pillar, topic } : undefined;
}

/** Every (pillar, topic) pair — feeds generateStaticParams. */
export function allTopicParams(): { pillar: PillarId; topic: string }[] {
  return PILLARS.flatMap((pillar) =>
    pillar.topics.map((topic) => ({ pillar: pillar.id, topic: topic.slug }))
  );
}
