-- Supabase's default privileges grant EXECUTE on every new public function to
-- anon directly, so 009's `REVOKE ... FROM PUBLIC` never took it away from
-- signed-out callers. Close that for the RPCs and trigger functions.
--
-- Deliberately left callable by anon: project_role, is_project_member,
-- can_edit_project, shares_project_with, can_view_user_profile,
-- current_user_email. RLS policies without a `TO` clause (e.g. "Read personal
-- or project items" on lnp_saved_items) call them for anon queries too —
-- /api/keep-alive is one — and revoking would turn an empty result into a
-- permission error. They only answer about auth.uid(), which is NULL for anon.

-- RPCs: signed-in users only.
REVOKE EXECUTE ON FUNCTION create_research_project(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION lookup_research_project(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION invite_research_project_member(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION respond_research_project_invitation(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION request_research_project_join(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION review_research_project_join_request(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION set_research_project_member_role(UUID, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION remove_research_project_member(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION leave_research_project(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION set_research_project_archived(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION copy_saved_item_bundle_to_project(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION copy_saved_item_bundle_to_personal(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION record_project_activity(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, BOOLEAN) FROM anon;

-- Trigger functions: nobody needs to call these over /rest/v1/rpc. Triggers
-- still fire — EXECUTE is not checked for trigger invocation.
REVOKE EXECUTE ON FUNCTION audit_project_saved_item() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION sync_user_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;

-- Pin search_path on the two functions the linter flags as mutable.
ALTER FUNCTION handle_new_user() SET search_path = public;
ALTER FUNCTION set_lnp_saved_item_sync_fields() SET search_path = public;
