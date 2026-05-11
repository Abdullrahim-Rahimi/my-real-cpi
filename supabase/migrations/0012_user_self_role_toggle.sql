-- Let users toggle their OWN role rows between 'active' and 'suspended'.
-- This is the self-resignation / reactivation path.
--
-- Critical safety constraints encoded in the policy:
--   - The USING clause restricts which rows the user can touch to rows they
--     own AND whose current status is already 'active' or 'suspended'.
--     Rows with status='pending' are deliberately invisible to the update:
--     a user can NOT promote themselves out of pending to active. That stays
--     a moderator-only transition.
--   - The WITH CHECK clause restricts the post-update row to the same shape:
--     status must remain 'active' or 'suspended'. Combined with the USING
--     filter, the only legal transitions are active <-> suspended on the
--     user's own previously-approved roles.
--
-- The existing "moderators manage contributors" policy is unchanged; mods
-- can still do anything (approve from pending, change role, delete, etc.).

drop policy if exists "users toggle own active/suspended" on public.country_contributors;
create policy "users toggle own active/suspended" on public.country_contributors
  for update
  using (
    user_id = auth.uid()
    and status in ('active', 'suspended')
  )
  with check (
    user_id = auth.uid()
    and status in ('active', 'suspended')
  );
