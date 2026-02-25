import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Atom, Pill, Microscope, Dna } from "lucide-react";

const topics = [
  {
    title: "Lipid Nanoparticles (LNPs)",
    icon: Atom,
    tags: ["mRNA delivery", "ionizable lipids", "PEG-lipids"],
    content: `Lipid nanoparticles are the leading non-viral delivery platform for nucleic acid therapeutics. 
    They typically consist of four components: ionizable lipids, helper lipids (e.g., DSPC), cholesterol, 
    and PEG-lipids. The ionizable lipid is the key functional component that enables endosomal escape 
    after cellular uptake. The success of mRNA COVID-19 vaccines (Pfizer-BioNTech and Moderna) has 
    validated LNPs as a clinically proven delivery system.`,
  },
  {
    title: "mRNA Therapeutics",
    icon: Dna,
    tags: ["nucleoside modifications", "5' cap", "poly(A) tail", "codon optimization"],
    content: `mRNA therapeutics represent a revolutionary approach to medicine, enabling cells to produce 
    therapeutic proteins directly. Key design elements include: optimized 5' UTR and 3' UTR sequences 
    for translation efficiency, modified nucleosides (e.g., N1-methylpseudouridine) to reduce 
    immunogenicity, codon optimization of the coding sequence (CDS), and an optimized poly(A) tail 
    length for mRNA stability.`,
  },
  {
    title: "Targeted Delivery",
    icon: Microscope,
    tags: ["active targeting", "passive targeting", "EPR effect", "ligand conjugation"],
    content: `Targeted delivery aims to accumulate nanomedicines at the disease site while minimizing 
    off-target effects. Passive targeting exploits the enhanced permeability and retention (EPR) effect 
    in tumor tissues. Active targeting involves conjugating specific ligands (antibodies, peptides, 
    aptamers) to the nanoparticle surface to enable receptor-mediated endocytosis.`,
  },
  {
    title: "Polymer-based Nanoparticles",
    icon: Pill,
    tags: ["PLGA", "PEI", "chitosan", "dendrimers"],
    content: `Polymeric nanoparticles offer versatile platforms for drug delivery. Common biodegradable 
    polymers include PLGA, PLA, and PCL for controlled release applications. Cationic polymers like 
    PEI and chitosan can complex with nucleic acids for gene delivery. Dendrimers provide precise 
    control over size and surface functionality. Each polymer system has unique advantages in terms 
    of drug loading, release kinetics, and biocompatibility.`,
  },
];

export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Research Topics</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          An overview of key topics in nano drug delivery systems and nucleic acid
          therapeutics.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {topics.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <topic.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{topic.title}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {topic.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-muted-foreground">{topic.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
