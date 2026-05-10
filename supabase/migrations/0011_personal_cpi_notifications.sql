-- Personal-CPI email notifications.
--
-- Two changes:
--   1. user_profiles.notify_personal_cpi  (boolean, default true) — per-user
--      opt-out flag. Users can disable from the dashboard or via the
--      one-click unsubscribe link in every email.
--   2. personal_cpi_notifications — append-only log keyed by
--      (user_id, country_code, period). Prevents sending the same period's
--      update twice (e.g., if the cron retries or a community submission
--      goes live for a period the cron already covered).

alter table public.user_profiles
  add column if not exists notify_personal_cpi boolean not null default true;

create table if not exists public.personal_cpi_notifications (
  user_id      uuid not null references auth.users(id) on delete cascade,
  country_code text not null references public.countries(code) on delete cascade,
  period       date not null,
  sent_at      timestamptz not null default now(),
  primary key (user_id, country_code, period)
);

create index if not exists personal_cpi_notifications_user_idx
  on public.personal_cpi_notifications (user_id, sent_at desc);

alter table public.personal_cpi_notifications enable row level security;

-- Users can see their own notification history (transparency).
drop policy if exists "users read own notifications" on public.personal_cpi_notifications;
create policy "users read own notifications" on public.personal_cpi_notifications
  for select using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy means only the service role (cron + the
-- approveBatch action's after-effect) can write. That's intentional —
-- clients should never be able to forge a notification record.
