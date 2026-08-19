-- Follow-up for projects that already applied 014_workbench_broadcast.sql.
-- Keep database Broadcast limited to the three large manual-save workbenches.

CREATE OR REPLACE FUNCTION public.broadcast_lnp_saved_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.lnp_saved_items;
  v_topic TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  IF v_row.type NOT IN ('tlnp_experiment', 'ivt_batch', 'screening_session') THEN
    RETURN v_row;
  END IF;

  v_topic := CASE
    WHEN v_row.project_id IS NULL THEN 'workbench:user:' || v_row.user_id::text
    ELSE 'workbench:project:' || v_row.project_id::text
  END;

  PERFORM realtime.send(
    jsonb_build_object(
      'id', v_row.id,
      'type', v_row.type,
      'project_id', v_row.project_id,
      'data_revision', v_row.data_revision,
      'updated_at', v_row.updated_at,
      'last_modified_by', v_row.last_modified_by,
      'operation', TG_OP
    ),
    'lnp_saved_item_changed',
    v_topic,
    true
  );
  RETURN v_row;
END;
$$;
