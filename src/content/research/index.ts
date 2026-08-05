import type { Pillar } from "./types";

/**
 * The research programme, as data.
 *
 * There are deliberately no per-topic routes. Topics expand in place on the
 * homepage and are deep-linkable by hash (`/#utr-models`), because a
 * drill-down page that only repeats the card costs a navigation and buys
 * nothing.
 *
 * Adding a topic is one object here.
 */
export const PILLARS: Pillar[] = [
  {
    id: "lnp",
    title: "Lipid nanoparticles",
    shortTitle: "LNP",
    stage: "Delivery",
    diagram: "lnp-cross-section",
    accent: "lnp",
    question: "How do you make the particle choose where it goes?",
    intro:
      "Over ninety percent of an intravenous LNP dose ends up in the liver, because serum ApoE adsorbs to the particle and hands it to hepatocyte LDL receptors. That accident built the field and is now its ceiling. Two lines of work on it: putting a ligand on the surface that overrides the default, and asking what a fifth component can do that the canonical four cannot.",
    topics: [
      {
        slug: "antibody-targeting",
        title: "Antibody-directed T cell targeting",
        tagline: "Conjugated antibodies for in vivo CAR-T",
        summary:
          "Conjugating antibodies to the LNP surface to steer particles onto T cells, generating CAR-T inside the patient rather than in a manufacturing suite.",
        detail: [
          "A surface-conjugated antibody overrides the ApoE-driven hepatic default that otherwise takes most of an intravenous dose.",
          "The target is the T cell: mRNA encoding the CAR is translated in situ, which removes apheresis, ex vivo expansion and the whole cell-manufacturing chain.",
          "Open questions are conjugation chemistry and valency, whether binding survives formulation intact, and what dose produces a functionally useful CAR-positive fraction.",
        ],
        keywords: ["in vivo CAR-T", "antibody conjugation", "T cell targeting", "ApoE"],
        status: "active",
      },
      {
        slug: "fifth-component",
        title: "Bioactive small molecule as a fifth component",
        tagline: "One additive, two effects",
        summary:
          "Screening pharmacologically active small molecules as a fifth lipid component, so the additive carries its own pharmacology while also shifting expression and biodistribution.",
        detail: [
          "The four-lipid formulation is a screening optimum, not a constraint. A fifth species is unused design space.",
          "The gain is meant to be dual: the molecule acts on its own target, and simultaneously changes where the particle goes and how much protein comes out of it.",
          "The screen therefore has to read out expression level and organ distribution together, not potency alone.",
        ],
        keywords: ["fifth component", "formulation screening", "biodistribution", "expression yield"],
        status: "active",
      },
    ],
  },
  {
    id: "mrna",
    title: "mRNA UTR engineering",
    shortTitle: "mRNA",
    stage: "Message",
    diagram: "mrna-construct",
    accent: "utr",
    question: "If the particle picks the organ, can the sequence pick the cell?",
    intro:
      "Delivery and expression are usually treated as one problem to be solved by the carrier. They are not. The untranslated regions flanking the coding sequence set ribosome loading, transcript half-life, and — through each cell type's own miRNA and RNA-binding-protein landscape — whether a transcript is translated there at all. Holding the coding sequence fixed and rewriting the ends gives a second layer of control that costs nothing in lipid chemistry.",
    topics: [
      {
        slug: "mirna-target-sites",
        title: "miRNA target sites for cell-specific silencing",
        tagline: "Detargeting liver, immune and muscle from the sequence",
        summary:
          "Writing miRNA target-site sequences into the UTRs so translation is switched off in liver, immune cells and muscle — control handed to the cell's own miRNA landscape instead of to the carrier.",
        detail: [
          "miR-122 in hepatocytes, miR-142 in haematopoietic cells and miR-1/miR-206 in muscle act as sequence-encoded off switches.",
          "The control is subtractive: the particle still arrives, but the transcript is not translated where it should not be.",
          "Because it lives in the sequence, it stacks with formulation-side tropism instead of competing with it.",
        ],
        keywords: ["miR-122", "miR-142", "detargeting", "translational control"],
        status: "active",
      },
      {
        slug: "spleen-targeting",
        title: "UTR-directed spleen targeting",
        tagline: "Reaching immune cells by rewriting the ends",
        summary:
          "Tuning UTR design so expression concentrates in the spleen, where the antigen-presenting and immune cells that matter for vaccines and cell therapy actually live.",
        detail: [
          "The spleen is the destination that matters for anything immunological, and it is not where a default LNP goes.",
          "Pairing UTR design with formulation-side tropism, rather than relying on lipid chemistry alone to move the particle.",
          "Readout is expression per organ, not particle accumulation per organ — the two come apart more often than the field admits.",
        ],
        keywords: ["splenic tropism", "antigen-presenting cells", "UTR design", "immune targeting"],
        status: "active",
      },
      {
        slug: "utr-models",
        title: "UTR scoring and generative models",
        tagline: "Designing libraries instead of sampling them",
        summary:
          "Training new scoring and generative models for UTR sequences, aimed at membrane and secreted proteins — where expression is least predictable from sequence.",
        detail: [
          "High-throughput UTR screens generate far more sequence-to-expression data than anyone reads back out of them.",
          "A scoring model ranks candidates; a generative model proposes sequences the screened library never contained.",
          "Focused on membrane and secreted proteins, where signal-peptide handling and trafficking load make expression hardest to predict.",
        ],
        keywords: ["sequence-to-expression", "generative model", "membrane proteins", "secreted proteins"],
        status: "active",
      },
    ],
  },
  {
    id: "disease",
    title: "Disease programmes",
    shortTitle: "Disease",
    stage: "Application",
    diagram: "disease-programmes",
    accent: "disease",
    question: "What becomes treatable once you control both the cell and the message?",
    intro:
      "Targeting and sequence design are means. These four programmes are where a solved delivery problem changes what is clinically reachable — each currently limited less by the underlying biology than by the inability to put the right transcript in the right cell at a tolerable dose.",
    topics: [
      {
        slug: "car-t-sle",
        title: "in vivo CAR-T for lupus",
        tagline: "Cell therapy without the cell manufacturing",
        summary:
          "Treating systemic lupus erythematosus with CAR-T generated inside the patient, collapsing an entire ex vivo manufacturing pipeline into an infusion.",
        detail: [
          "CD19 CAR-T has already produced drug-free remission in refractory SLE, which makes the biology the settled part.",
          "What blocks it is manufacturing: cost, turnaround and the lymphodepletion that comes with it.",
          "Generating the cells in situ turns a bespoke product into a dose, which is the difference between a case series and a treatment.",
        ],
        keywords: ["SLE", "CD19 CAR", "autoimmunity", "in vivo engineering"],
        status: "active",
      },
      {
        slug: "pcsk9-editing",
        title: "PCSK9 editing for hypercholesterolaemia",
        tagline: "Hepatic delivery, one permanent edit",
        summary:
          "Liver-targeted delivery of editing machinery for efficient PCSK9 knockout — the one indication where the hepatic default is an advantage rather than a ceiling.",
        detail: [
          "PCSK9 is the cleanest available proof that a single in vivo edit can replace lifelong daily dosing.",
          "The editor is transient by construction, which removes the integration risk that shadows viral vectors.",
          "Here the ApoE-driven liver tropism everyone else is fighting is exactly the behaviour you want.",
        ],
        keywords: ["PCSK9", "base editing", "hypercholesterolaemia", "hepatic delivery"],
        status: "active",
      },
      {
        slug: "cytokine-therapy",
        title: "Cytokine therapy in tumour immunology",
        tagline: "Encode the cytokine instead of infusing it",
        summary:
          "mRNA-encoded cytokines, so the protein is produced where the particle lands rather than dosed systemically at a concentration the patient cannot tolerate.",
        detail: [
          "Systemic cytokines have a therapeutic window so narrow it has sunk most of the class.",
          "Encoding rather than infusing moves the concentration peak into the tissue and flattens the systemic exposure.",
          "This is the programme that depends most directly on the targeting work — it is only as good as the delivery is specific.",
        ],
        keywords: ["cytokine", "tumour microenvironment", "therapeutic window", "local expression"],
        status: "active",
      },
      {
        slug: "lytac-degrader",
        title: "RNA-encoded LYTAC degraders",
        tagline: "CD47–SIRPα in colorectal cancer",
        summary:
          "Adapting LYTAC — lysosome-targeting chimeras — into an RNA-encoded format, aimed at the CD47–SIRPα axis in colorectal cancer to release macrophage phagocytosis.",
        detail: [
          "LYTAC degrades extracellular and membrane proteins that intracellular degraders cannot reach, by routing them to the lysosome.",
          "Encoding the chimera as RNA means the cell manufactures the degrader, rather than the degrader having to be delivered as a synthesised protein conjugate.",
          "CD47–SIRPα is the target: removing the 'don't eat me' signal on colorectal tumour cells to restore macrophage phagocytosis.",
        ],
        diagram: "lytac-degrader",
        keywords: ["LYTAC", "CD47", "SIRPα", "colorectal cancer"],
        status: "active",
      },
    ],
  },
];

/** Every topic, flattened, with its pillar attached. */
export const ALL_TOPICS = PILLARS.flatMap((pillar) =>
  pillar.topics.map((topic) => ({ pillar, topic }))
);
