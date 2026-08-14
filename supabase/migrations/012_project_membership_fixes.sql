-- Fix project membership presentation and allow active project managers to
-- change other non-owner users between administrator and member roles.

CREATE OR REPLACE FUNCTION set_research_project_member_role(
  p_project_id UUID, p_user_id UUID, p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_target_role TEXT;
  v_email TEXT;
BEGIN
  v_actor_role := project_role(p_project_id);
  IF v_actor_role NOT IN ('owner', 'admin')
     OR NOT can_edit_project(p_project_id)
     OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own project role';
  END IF;

  SELECT role INTO v_target_role
  FROM research_project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  IF v_target_role IS NULL OR v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF v_target_role = p_role THEN RETURN; END IF;

  UPDATE research_project_members
  SET role = p_role
  WHERE project_id = p_project_id AND user_id = p_user_id;

  SELECT email INTO v_email FROM user_profiles WHERE id = p_user_id;
  PERFORM record_project_activity(
    p_project_id, 'member', 'role_changed', 'member', p_user_id::text,
    coalesce(v_email, ''),
    '将 ' || coalesce(v_email, '成员') || ' 的权限调整为' ||
      CASE WHEN p_role = 'admin' THEN '管理员' ELSE '成员' END
  );
END;
$$;

REVOKE ALL ON FUNCTION set_research_project_member_role(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_research_project_member_role(UUID, UUID, TEXT) TO authenticated;
