-- Convert databases that already applied the original 009 migration from
-- PRJ-XXXXXXXX codes to the simpler four-digit project code.

ALTER TABLE research_projects
  DROP CONSTRAINT IF EXISTS research_projects_code_check;

DO $$
DECLARE
  v_project RECORD;
  v_code TEXT;
BEGIN
  FOR v_project IN
    SELECT id FROM research_projects
    WHERE code !~ '^[0-9]{4}$'
    ORDER BY created_at, id
  LOOP
    LOOP
      v_code := lpad(floor(random() * 10000)::integer::text, 4, '0');
      BEGIN
        UPDATE research_projects SET code = v_code WHERE id = v_project.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- Retry until this existing project receives an unused four-digit code.
      END;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE research_projects
  ADD CONSTRAINT research_projects_code_check CHECK (code ~ '^[0-9]{4}$');

CREATE OR REPLACE FUNCTION create_research_project(p_name TEXT, p_description TEXT DEFAULT '')
RETURNS research_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project research_projects;
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Project name is required';
  END IF;
  LOOP
    v_code := lpad(floor(random() * 10000)::integer::text, 4, '0');
    BEGIN
      INSERT INTO research_projects (code, name, description, owner_id)
      VALUES (v_code, trim(p_name), left(coalesce(p_description, ''), 1000), auth.uid())
      RETURNING * INTO v_project;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Four digits are intentionally easy to share; retry on collision.
    END;
  END LOOP;

  INSERT INTO research_project_members(project_id, user_id, role)
  VALUES (v_project.id, auth.uid(), 'owner');
  PERFORM record_project_activity(v_project.id, 'member', 'project_created',
    'project', v_project.id::text, v_project.name,
    '创建了课题「' || v_project.name || '」');
  RETURN v_project;
END;
$$;

REVOKE ALL ON FUNCTION create_research_project(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_research_project(TEXT, TEXT) TO authenticated;
