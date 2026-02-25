-- LNP saved items: formulas and preparations with folder hierarchy
CREATE TABLE IF NOT EXISTS lnp_saved_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('formula', 'preparation')),
  is_folder   BOOLEAN DEFAULT false NOT NULL,
  parent_id   UUID REFERENCES lnp_saved_items(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  data        JSONB,
  sort_order  INTEGER DEFAULT 0 NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_lnp_saved_items_user ON lnp_saved_items(user_id, type);
CREATE INDEX idx_lnp_saved_items_parent ON lnp_saved_items(parent_id);

ALTER TABLE lnp_saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own items"
  ON lnp_saved_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own items"
  ON lnp_saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON lnp_saved_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON lnp_saved_items FOR DELETE
  USING (auth.uid() = user_id);
