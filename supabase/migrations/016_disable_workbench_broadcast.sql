-- Workbenches now use manual save and manual cloud reload only.
-- Remove the metadata-only Broadcast path introduced by migrations 014/015.

DROP TRIGGER IF EXISTS lnp_saved_items_broadcast
  ON public.lnp_saved_items;

DROP FUNCTION IF EXISTS public.broadcast_lnp_saved_item_change();

DROP POLICY IF EXISTS "Workbench members can receive broadcasts"
  ON realtime.messages;
