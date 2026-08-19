-- Match the lightweight sidebar query exactly so Postgres can filter and
-- return rows in display order without scanning/sorting large JSON payloads.
-- Apply after the Disk IO budget has recovered, during a low-traffic window.

CREATE INDEX IF NOT EXISTS idx_lnp_saved_items_project_type_order
  ON lnp_saved_items(project_id, type, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lnp_saved_items_personal_type_order
  ON lnp_saved_items(user_id, type, sort_order ASC, created_at DESC)
  WHERE project_id IS NULL;
