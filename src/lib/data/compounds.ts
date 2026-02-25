export interface Compound {
  name: string;
  formula?: string;
  mw: number;
  category: string;
}

export const COMPOUNDS: Compound[] = [
  // Amino acids
  { name: "Alanine (Ala)", formula: "C3H7NO2", mw: 89.09, category: "Amino Acid" },
  { name: "Arginine (Arg)", formula: "C6H14N4O2", mw: 174.20, category: "Amino Acid" },
  { name: "Asparagine (Asn)", formula: "C4H8N2O3", mw: 132.12, category: "Amino Acid" },
  { name: "Aspartic acid (Asp)", formula: "C4H7NO4", mw: 133.10, category: "Amino Acid" },
  { name: "Cysteine (Cys)", formula: "C3H7NO2S", mw: 121.16, category: "Amino Acid" },
  { name: "Glutamic acid (Glu)", formula: "C5H9NO4", mw: 147.13, category: "Amino Acid" },
  { name: "Glutamine (Gln)", formula: "C5H10N2O3", mw: 146.15, category: "Amino Acid" },
  { name: "Glycine (Gly)", formula: "C2H5NO2", mw: 75.03, category: "Amino Acid" },
  { name: "Histidine (His)", formula: "C6H9N3O2", mw: 155.16, category: "Amino Acid" },
  { name: "Isoleucine (Ile)", formula: "C6H13NO2", mw: 131.17, category: "Amino Acid" },
  { name: "Leucine (Leu)", formula: "C6H13NO2", mw: 131.17, category: "Amino Acid" },
  { name: "Lysine (Lys)", formula: "C6H14N2O2", mw: 146.19, category: "Amino Acid" },
  { name: "Methionine (Met)", formula: "C5H11NO2S", mw: 149.21, category: "Amino Acid" },
  { name: "Phenylalanine (Phe)", formula: "C9H11NO2", mw: 165.19, category: "Amino Acid" },
  { name: "Proline (Pro)", formula: "C5H9NO2", mw: 115.13, category: "Amino Acid" },
  { name: "Serine (Ser)", formula: "C3H7NO3", mw: 105.09, category: "Amino Acid" },
  { name: "Threonine (Thr)", formula: "C4H9NO3", mw: 119.12, category: "Amino Acid" },
  { name: "Tryptophan (Trp)", formula: "C11H12N2O2", mw: 204.23, category: "Amino Acid" },
  { name: "Tyrosine (Tyr)", formula: "C9H11NO3", mw: 181.19, category: "Amino Acid" },
  { name: "Valine (Val)", formula: "C5H11NO2", mw: 117.15, category: "Amino Acid" },

  // Nucleotides
  { name: "ATP", formula: "C10H16N5O13P3", mw: 507.18, category: "Nucleotide" },
  { name: "GTP", formula: "C10H16N5O14P3", mw: 523.18, category: "Nucleotide" },
  { name: "CTP", formula: "C9H16N3O14P3", mw: 483.16, category: "Nucleotide" },
  { name: "UTP", formula: "C9H15N2O15P3", mw: 484.14, category: "Nucleotide" },
  { name: "dATP", formula: "C10H16N5O12P3", mw: 491.18, category: "Nucleotide" },
  { name: "dGTP", formula: "C10H16N5O13P3", mw: 507.18, category: "Nucleotide" },
  { name: "dCTP", formula: "C9H16N3O13P3", mw: 467.16, category: "Nucleotide" },
  { name: "dTTP", formula: "C10H17N2O14P3", mw: 482.17, category: "Nucleotide" },

  // Buffers
  { name: "Tris base", formula: "C4H11NO3", mw: 121.14, category: "Buffer" },
  { name: "Tris-HCl", formula: "C4H12ClNO3", mw: 157.60, category: "Buffer" },
  { name: "HEPES", formula: "C8H18N2O4S", mw: 238.30, category: "Buffer" },
  { name: "PIPES", formula: "C8H18N2O6S2", mw: 302.37, category: "Buffer" },
  { name: "MES", formula: "C6H13NO4S", mw: 195.24, category: "Buffer" },
  { name: "MOPS", formula: "C7H15NO4S", mw: 209.26, category: "Buffer" },
  { name: "PBS (NaCl component)", formula: "NaCl", mw: 58.44, category: "Buffer" },
  { name: "Sodium acetate", formula: "C2H3NaO2", mw: 82.03, category: "Buffer" },
  { name: "Sodium citrate", formula: "C6H5Na3O7", mw: 258.07, category: "Buffer" },

  // Salts
  { name: "NaCl", formula: "NaCl", mw: 58.44, category: "Salt" },
  { name: "KCl", formula: "KCl", mw: 74.55, category: "Salt" },
  { name: "MgCl₂", formula: "MgCl2", mw: 95.21, category: "Salt" },
  { name: "MgCl₂·6H₂O", formula: "MgCl2·6H2O", mw: 203.30, category: "Salt" },
  { name: "CaCl₂", formula: "CaCl2", mw: 110.98, category: "Salt" },
  { name: "MgSO₄", formula: "MgSO4", mw: 120.37, category: "Salt" },
  { name: "NaHCO₃", formula: "NaHCO3", mw: 84.01, category: "Salt" },
  { name: "Na₂HPO₄", formula: "Na2HPO4", mw: 141.96, category: "Salt" },
  { name: "KH₂PO₄", formula: "KH2PO4", mw: 136.09, category: "Salt" },
  { name: "(NH₄)₂SO₄", formula: "(NH4)2SO4", mw: 132.14, category: "Salt" },

  // Detergents
  { name: "SDS", formula: "C12H25NaO4S", mw: 288.38, category: "Detergent" },
  { name: "Triton X-100", mw: 625.0, category: "Detergent" },
  { name: "Tween 20", mw: 1228.0, category: "Detergent" },
  { name: "Tween 80", mw: 1310.0, category: "Detergent" },
  { name: "NP-40", mw: 603.0, category: "Detergent" },
  { name: "CHAPS", formula: "C32H58N2O7S", mw: 614.88, category: "Detergent" },

  // Antibiotics
  { name: "Ampicillin sodium", formula: "C16H18N3NaO4S", mw: 371.39, category: "Antibiotic" },
  { name: "Kanamycin sulfate", mw: 582.58, category: "Antibiotic" },
  { name: "Chloramphenicol", formula: "C11H12Cl2N2O5", mw: 323.13, category: "Antibiotic" },
  { name: "Spectinomycin", formula: "C14H24N2O7", mw: 332.35, category: "Antibiotic" },
  { name: "Gentamicin sulfate", mw: 575.67, category: "Antibiotic" },
  { name: "Puromycin", formula: "C22H29N7O5", mw: 471.52, category: "Antibiotic" },
  { name: "Hygromycin B", formula: "C20H37N3O13", mw: 527.52, category: "Antibiotic" },
  { name: "Blasticidin S", formula: "C17H26N8O5", mw: 422.44, category: "Antibiotic" },
  { name: "G418 (Geneticin)", mw: 496.55, category: "Antibiotic" },
  { name: "Tetracycline", formula: "C22H24N2O8", mw: 444.44, category: "Antibiotic" },

  // Common lab reagents
  { name: "IPTG", formula: "C9H18O5S", mw: 238.30, category: "Reagent" },
  { name: "X-gal", formula: "C14H15BrClNO6", mw: 408.63, category: "Reagent" },
  { name: "DTT", formula: "C4H10O2S2", mw: 154.25, category: "Reagent" },
  { name: "TCEP", formula: "C9H15O6P", mw: 250.19, category: "Reagent" },
  { name: "β-Mercaptoethanol", formula: "C2H6OS", mw: 78.13, category: "Reagent" },
  { name: "EDTA disodium", formula: "C10H14N2Na2O8·2H2O", mw: 372.24, category: "Reagent" },
  { name: "EGTA", formula: "C14H24N2O10", mw: 380.35, category: "Reagent" },
  { name: "PMSF", formula: "C7H7FO2S", mw: 174.19, category: "Reagent" },
  { name: "Imidazole", formula: "C3H4N2", mw: 68.08, category: "Reagent" },
  { name: "Urea", formula: "CH4N2O", mw: 60.06, category: "Reagent" },
  { name: "Guanidine-HCl", formula: "CH6ClN3", mw: 95.53, category: "Reagent" },
  { name: "BSA", mw: 66430.0, category: "Reagent" },
  { name: "Ethidium bromide", formula: "C21H20BrN3", mw: 394.31, category: "Reagent" },
  { name: "DAPI", formula: "C16H15N5", mw: 277.32, category: "Reagent" },
  { name: "Paraformaldehyde", formula: "CH2O", mw: 30.03, category: "Reagent" },
  { name: "DMSO", formula: "C2H6OS", mw: 78.13, category: "Reagent" },

  // Sugars
  { name: "Glucose", formula: "C6H12O6", mw: 180.16, category: "Sugar" },
  { name: "Sucrose", formula: "C12H22O11", mw: 342.30, category: "Sugar" },
  { name: "Trehalose", formula: "C12H22O11", mw: 342.30, category: "Sugar" },
  { name: "Mannitol", formula: "C6H14O6", mw: 182.17, category: "Sugar" },
  { name: "Sorbitol", formula: "C6H14O6", mw: 182.17, category: "Sugar" },

  // Lipids (nano drug delivery)
  { name: "DSPC", formula: "C44H88NO8P", mw: 790.15, category: "Lipid" },
  { name: "Cholesterol", formula: "C27H46O", mw: 386.65, category: "Lipid" },
  { name: "DMG-PEG2000", mw: 2509.2, category: "Lipid" },
  { name: "SM-102", formula: "C44H87NO5", mw: 710.18, category: "Lipid" },
  { name: "ALC-0315", formula: "C48H95NO5", mw: 766.27, category: "Lipid" },
  { name: "ALC-0159 (PEG-lipid)", mw: 2403.5, category: "Lipid" },
  { name: "DOTAP", formula: "C42H80ClNO4", mw: 698.54, category: "Lipid" },
  { name: "DOPE", formula: "C41H78NO8P", mw: 744.03, category: "Lipid" },
  { name: "DPPC", formula: "C40H80NO8P", mw: 734.05, category: "Lipid" },
  { name: "DLin-MC3-DMA", formula: "C43H79NO2", mw: 642.09, category: "Lipid" },

  // Solvents & common
  { name: "Water", formula: "H2O", mw: 18.015, category: "Solvent" },
  { name: "Ethanol", formula: "C2H6O", mw: 46.07, category: "Solvent" },
  { name: "Methanol", formula: "CH4O", mw: 32.04, category: "Solvent" },
  { name: "Isopropanol", formula: "C3H8O", mw: 60.10, category: "Solvent" },
  { name: "Chloroform", formula: "CHCl3", mw: 119.38, category: "Solvent" },
  { name: "Acetic acid", formula: "C2H4O2", mw: 60.05, category: "Solvent" },
  { name: "Glycerol", formula: "C3H8O3", mw: 92.09, category: "Solvent" },

  // Staining & selection
  { name: "Coomassie Blue G-250", formula: "C47H48N3NaO7S2", mw: 854.02, category: "Stain" },
  { name: "Crystal violet", formula: "C25H30ClN3", mw: 407.98, category: "Stain" },
  { name: "Hoechst 33342", mw: 615.99, category: "Stain" },
];
