export interface Plasmid {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sequence: string | null;
  vector_type: string | null;
  resistance: string | null;
  size_bp: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlasmidFormData {
  name: string;
  description: string;
  sequence: string;
  vector_type: string;
  resistance: string;
}
