-- Contact-page feedback inbox.
-- Apply manually in the Supabase SQL editor, then review submissions in
-- Dashboard -> Table Editor -> feedback.

CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('tool_suggestion', 'bug_report', 'improvement')),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- There is deliberately no SELECT policy: submissions can only be reviewed
-- through the Supabase dashboard/service role, not downloaded by site users.
GRANT INSERT ON public.feedback TO anon, authenticated;

CREATE INDEX IF NOT EXISTS feedback_created_at_idx
  ON public.feedback (created_at DESC);

COMMENT ON TABLE public.feedback IS
  'Contact-page feedback inbox; review in Supabase Dashboard Table Editor.';
