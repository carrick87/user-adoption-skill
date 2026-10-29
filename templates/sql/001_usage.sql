-- Privacy-first usage analytics for Next.js + Supabase.
-- Identity comes from the signed-in session. Callers cannot set user_id or session_id.
-- Never store IP addresses, user agents, passwords, tokens, or raw search text.
--
-- Adapt usage_is_admin() and eligible-user CTEs to your profiles / memberships tables.
-- Replace APPLICATION_NAME below to match lib/usage/contract.ts APP_NAME.

create table if not exists public.usage_events (
  event_id uuid primary key default gen_random_uuid(),
  event_timestamp timestamptz not null default now(),
  event_name text not null,
  application text not null default 'App',
  application_version text not null,
  environment text not null,
  user_id uuid,
  user_role text,
  branch text,
  session_id uuid,
  correlation_id uuid,
  page text,
  module text,
  entity_type text,
  entity_id text,
  success boolean,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  constraint usage_events_name_check check (
    event_name in (
      'user_login',
      'user_logout',
      'session_started',
      'session_ended',
      'home_viewed',
      'searched',
      'filtered',
      'list_viewed',
      'export_completed',
      'export_failed',
      'access_denied',
      'access_waiting',
      'error_occurred',
      'admin_viewed',
      'adoption_viewed'
    )
  ),
  constraint usage_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.usage_entity_hits (
  event_id uuid not null references public.usage_events (event_id) on delete cascade,
  entity_id text not null,
  branch text,
  primary key (event_id, entity_id),
  constraint usage_entity_hits_id_check check (entity_id ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint usage_entity_hits_branch_check check (
    branch is null or branch ~ '^[A-Za-z0-9._:-]{1,32}$'
  )
);

create table if not exists public.usage_dev_gate (
  key_hash text primary key
);

create index if not exists usage_events_time_idx
  on public.usage_events (event_timestamp desc);
create index if not exists usage_events_user_time_idx
  on public.usage_events (user_id, event_timestamp desc);
create index if not exists usage_events_name_time_idx
  on public.usage_events (event_name, event_timestamp desc);
create index if not exists usage_events_session_idx
  on public.usage_events (session_id, event_timestamp);
create unique index if not exists usage_events_once_idx
  on public.usage_events (session_id, event_name)
  where session_id is not null
    and event_name in ('session_started', 'access_waiting');

alter table public.usage_events enable row level security;
alter table public.usage_entity_hits enable row level security;

-- >>> ADAPT: replace with your real admin / super-user check.
create or replace function public.usage_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select lower(coalesce(p.role, '')) in ('admin', 'super')
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    false
  );
$$;

create or replace function public.usage_can_read()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  header_key text;
  digest text;
begin
  if public.usage_is_admin() then
    return true;
  end if;
  begin
    header_key := nullif(current_setting('request.headers', true)::json->>'x-adoption-dev', '');
  exception when others then
    header_key := null;
  end;
  if header_key is null then
    return false;
  end if;
  digest := encode(extensions.digest(header_key, 'sha256'), 'hex');
  return exists (select 1 from public.usage_dev_gate g where g.key_hash = digest);
end;
$$;

drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select on public.usage_events
  for select to authenticated
  using (public.usage_is_admin());

drop policy if exists usage_entity_hits_select on public.usage_entity_hits;
create policy usage_entity_hits_select on public.usage_entity_hits
  for select to authenticated
  using (public.usage_is_admin());

revoke all on public.usage_events from public, anon, authenticated;
revoke all on public.usage_entity_hits from public, anon, authenticated;
grant select on public.usage_events to authenticated;
grant select on public.usage_entity_hits to authenticated;

create or replace function public.usage_is_meaningful(event_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select event_name in (
    'home_viewed',
    'searched',
    'filtered',
    'list_viewed',
    'export_completed'
  );
$$;

create or replace function public.usage_metadata(raw jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  item record;
  kept jsonb;
begin
  if raw is null or jsonb_typeof(raw) <> 'object' then
    return result;
  end if;

  for item in select key, value from jsonb_each(raw)
  loop
    if item.key = 'filter_columns' and jsonb_typeof(item.value) = 'array' then
      select coalesce(jsonb_agg(to_jsonb(token)), '[]'::jsonb)
        into kept
      from jsonb_array_elements_text(item.value) as token
      where token ~ '^[a-z0-9_]{1,40}$';
      result := result || jsonb_build_object('filter_columns', coalesce(kept, '[]'::jsonb));
    elsif item.key in ('zero_results')
      and jsonb_typeof(item.value) = 'boolean' then
      result := result || jsonb_build_object(item.key, item.value);
    elsif item.key in (
      'result_count', 'page', 'page_size', 'row_count', 'http_status'
    ) and jsonb_typeof(item.value) = 'number' then
      result := result || jsonb_build_object(item.key, item.value);
    elsif item.key in (
      'search_class', 'status', 'side', 'group_id', 'sort', 'direction', 'action', 'error_code'
    ) and jsonb_typeof(item.value) = 'string'
      and length(item.value #>> '{}') <= 64
      and (item.value #>> '{}') ~ '^[A-Za-z0-9_ .:/-]+$' then
      result := result || jsonb_build_object(item.key, item.value);
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.usage_events_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- >>> ADAPT: keep in sync with APP_NAME in contract.ts
  new.application := 'App';
  new.metadata := public.usage_metadata(new.metadata);
  if new.entity_id is not null and new.entity_id !~ '^[A-Za-z0-9._:-]{1,64}$' then
    new.entity_id := null;
  end if;
  if new.branch is not null and new.branch !~ '^[A-Za-z0-9._:-]{1,32}$' then
    new.branch := null;
  end if;
  return new;
end;
$$;

drop trigger if exists usage_events_guard on public.usage_events;
create trigger usage_events_guard
  before insert or update on public.usage_events
  for each row execute function public.usage_events_guard();

create or replace function public.usage_record_usage(events jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  role text;
  item jsonb;
  name text;
  meta jsonb;
  event_row uuid;
  entity text;
  branch text;
  page_name text;
  module_name text;
  entity_kind text;
  correlation uuid;
  version text;
  env text;
  duration integer;
  succeeded boolean;
  hit jsonb;
  hit_id text;
  hit_branch text;
  seen integer := 0;
  hit_count integer;
begin
  if events is null or jsonb_typeof(events) <> 'array' then
    return;
  end if;

  begin
    sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;

  select p.role into role
  from public.profiles p
  where p.id = uid
  limit 1;

  -- Allow unauthenticated login-page errors only.
  if uid is null then
    for item in select value from jsonb_array_elements(events)
    loop
      name := item.value ->> 'event_name';
      if name is distinct from 'error_occurred' then
        return;
      end if;
      if coalesce(item.value ->> 'page', '') is distinct from 'login' then
        return;
      end if;
    end loop;
  end if;

  if sid is not null and uid is not null then
    insert into public.usage_events (
      event_name, application_version, environment, user_id, user_role,
      session_id, page, module, success
    ) values (
      'session_started', '0.0.0', 'unknown', uid, role, sid, 'session', 'auth', true
    )
    on conflict do nothing;
  end if;

  for item in select value from jsonb_array_elements(events)
  loop
    seen := seen + 1;
    if seen > 20 then
      exit;
    end if;

    name := item.value ->> 'event_name';
    if name is null or name not in (
      'user_login', 'user_logout', 'session_started', 'session_ended',
      'home_viewed', 'searched', 'filtered', 'list_viewed',
      'export_completed', 'export_failed', 'access_denied', 'access_waiting',
      'error_occurred', 'admin_viewed', 'adoption_viewed'
    ) then
      continue;
    end if;

    version := left(coalesce(nullif(item.value ->> 'application_version', ''), '0.0.0'), 32);
    env := left(coalesce(nullif(item.value ->> 'environment', ''), 'development'), 32);
    branch := nullif(item.value ->> 'branch', '');
    page_name := left(coalesce(nullif(item.value ->> 'page', ''), 'unknown'), 64);
    module_name := left(coalesce(nullif(item.value ->> 'module', ''), 'unknown'), 64);
    entity_kind := nullif(item.value ->> 'entity_type', '');
    entity := nullif(item.value ->> 'entity_id', '');
    meta := public.usage_metadata(coalesce(item.value -> 'metadata', '{}'::jsonb));
    duration := nullif(item.value ->> 'duration_ms', '')::integer;
    succeeded := case
      when item.value ->> 'success' is null then null
      else (item.value ->> 'success')::boolean
    end;

    begin
      correlation := nullif(item.value ->> 'correlation_id', '')::uuid;
    exception when others then
      correlation := null;
    end;

    insert into public.usage_events (
      event_name, application_version, environment, user_id, user_role, branch,
      session_id, correlation_id, page, module, entity_type, entity_id,
      success, duration_ms, metadata
    ) values (
      name, version, env, uid, role, branch, sid, correlation,
      page_name, module_name, entity_kind, entity, succeeded, duration, meta
    )
    returning event_id into event_row;

    if name = 'list_viewed' and jsonb_typeof(item.value -> 'entities') = 'array' then
      hit_count := 0;
      for hit in select value from jsonb_array_elements(item.value -> 'entities')
      loop
        hit_count := hit_count + 1;
        if hit_count > 500 then
          exit;
        end if;
        hit_id := nullif(hit.value ->> 'entity_id', '');
        hit_branch := nullif(hit.value ->> 'branch', '');
        if hit_id is null or hit_id !~ '^[A-Za-z0-9._:-]{1,64}$' then
          continue;
        end if;
        insert into public.usage_entity_hits (event_id, entity_id, branch)
        values (event_row, hit_id, hit_branch)
        on conflict do nothing;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.usage_record_usage(jsonb) from public;
grant execute on function public.usage_record_usage(jsonb) to anon, authenticated;

-- Period helper
create or replace function public.usage_period_days(day_count integer)
returns integer
language sql
immutable
as $$
  select case when day_count in (7, 14, 30) then day_count else 7 end;
$$;

-- Company summary (starter — adapt eligible CTE to your directory).
create or replace function public.usage_company(day_count integer default 7)
returns table (
  eligible bigint,
  activated bigint,
  activation_rate numeric,
  active_users bigint,
  adoption_rate numeric,
  logged_in_once bigint,
  dau bigint,
  wau bigint,
  mau bigint,
  search_success_rate numeric,
  error_rate numeric,
  export_completion numeric,
  application_version text,
  environment text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := public.usage_period_days(day_count);
  period_start timestamptz := now() - make_interval(days => days);
  today_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if not public.usage_can_read() then
    return;
  end if;

  return query
  with eligible as (
    -- >>> ADAPT: join your profiles / memberships. Placeholder = distinct event users.
    select distinct e.user_id as id
    from public.usage_events e
    where e.user_id is not null
  ),
  meaningful as (
    select e.user_id, e.event_timestamp, e.event_name, e.session_id, e.metadata
    from public.usage_events e
    where e.user_id is not null
      and public.usage_is_meaningful(e.event_name)
  ),
  latest as (
    select e.application_version, e.environment
    from public.usage_events e
    order by e.event_timestamp desc
    limit 1
  )
  select
    (select count(*) from eligible)::bigint,
    (select count(distinct m.user_id) from meaningful m)::bigint,
    case when (select count(*) from eligible) = 0 then null
      else round(
        100.0 * (select count(distinct m.user_id) from meaningful m)
        / (select count(*) from eligible), 1)
    end,
    (select count(distinct m.user_id) from meaningful m where m.event_timestamp >= period_start)::bigint,
    case when (select count(*) from eligible) = 0 then null
      else round(
        100.0 * (select count(distinct m.user_id) from meaningful m where m.event_timestamp >= period_start)
        / (select count(*) from eligible), 1)
    end,
    (
      select count(*) from (
        select e.user_id
        from public.usage_events e
        where e.event_name = 'user_login' and e.user_id is not null
        group by e.user_id
        having count(*) = 1
          and not exists (
            select 1 from meaningful m where m.user_id = e.user_id
          )
      ) once
    )::bigint,
    (select count(distinct m.user_id) from meaningful m where m.event_timestamp >= today_start)::bigint,
    (select count(distinct m.user_id) from meaningful m where m.event_timestamp >= now() - interval '7 days')::bigint,
    (select count(distinct m.user_id) from meaningful m where m.event_timestamp >= now() - interval '30 days')::bigint,
    case when (select count(*) from public.usage_events e where e.event_name = 'searched' and e.event_timestamp >= period_start) = 0
      then null
      else round(
        100.0 * (
          select count(*) from public.usage_events e
          where e.event_name = 'searched'
            and e.event_timestamp >= period_start
            and coalesce((e.metadata ->> 'result_count')::numeric, 0) > 0
        ) / (
          select count(*) from public.usage_events e
          where e.event_name = 'searched' and e.event_timestamp >= period_start
        ), 1)
    end,
    case when (select count(distinct m.session_id) from meaningful m where m.event_timestamp >= period_start and m.session_id is not null) = 0
      then null
      else round(
        100.0 * (
          select count(distinct e.session_id) from public.usage_events e
          where e.event_timestamp >= period_start
            and e.session_id is not null
            and e.event_name in ('error_occurred', 'export_failed')
        ) / (
          select count(distinct m.session_id) from meaningful m
          where m.event_timestamp >= period_start and m.session_id is not null
        ), 1)
    end,
    case when (select count(distinct e.session_id) from public.usage_events e where e.event_name = 'home_viewed' and e.event_timestamp >= period_start and e.session_id is not null) = 0
      then null
      else round(
        100.0 * (
          select count(distinct e.session_id) from public.usage_events e
          where e.event_name = 'export_completed' and e.event_timestamp >= period_start and e.session_id is not null
        ) / (
          select count(distinct e.session_id) from public.usage_events e
          where e.event_name = 'home_viewed' and e.event_timestamp >= period_start and e.session_id is not null
        ), 1)
    end,
    (select l.application_version from latest l),
    (select l.environment from latest l);
end;
$$;

create or replace function public.usage_daily_rows(day_count integer default 7)
returns table (
  activity_date date,
  active_users bigint,
  logins bigint,
  searches bigint,
  searches_with_results bigint,
  exports bigint,
  errors bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := public.usage_period_days(day_count);
begin
  if not public.usage_can_read() then
    return;
  end if;

  return query
  select
    (e.event_timestamp at time zone 'UTC')::date as activity_date,
    count(distinct e.user_id) filter (where public.usage_is_meaningful(e.event_name))::bigint,
    count(*) filter (where e.event_name = 'user_login')::bigint,
    count(*) filter (where e.event_name = 'searched')::bigint,
    count(*) filter (
      where e.event_name = 'searched'
        and coalesce((e.metadata ->> 'result_count')::numeric, 0) > 0
    )::bigint,
    count(*) filter (where e.event_name = 'export_completed')::bigint,
    count(*) filter (where e.event_name in ('error_occurred', 'export_failed'))::bigint
  from public.usage_events e
  where e.event_timestamp >= now() - make_interval(days => days)
  group by 1
  order by 1 desc;
end;
$$;

create or replace function public.usage_user_rows(day_count integer default 7)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  first_login timestamptz,
  last_sign_in_at timestamptz,
  last_active timestamptz,
  login_count bigint,
  active_days bigint,
  sessions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := public.usage_period_days(day_count);
  period_start timestamptz := now() - make_interval(days => days);
begin
  if not public.usage_can_read() then
    return;
  end if;

  return query
  with per_user as (
    select
      e.user_id as uid,
      min(e.event_timestamp) filter (where e.event_name = 'user_login') as first_login,
      max(e.event_timestamp) filter (where public.usage_is_meaningful(e.event_name)) as last_active,
      count(*) filter (where e.event_name = 'user_login') as login_count,
      count(distinct (e.event_timestamp at time zone 'UTC')::date)
        filter (where public.usage_is_meaningful(e.event_name) and e.event_timestamp >= period_start) as active_days,
      count(distinct e.session_id) filter (where e.event_timestamp >= period_start) as sessions,
      max(e.user_role) as role
    from public.usage_events e
    where e.user_id is not null
    group by e.user_id
  )
  select
    p.uid,
    u.email::text,
    p.role,
    case
      when p.login_count = 1 and p.last_active is null then 'Logged in once'
      when p.last_active is null then 'Never used'
      when p.last_active < now() - interval '14 days' then 'Stopped'
      else 'Active'
    end,
    p.first_login,
    u.last_sign_in_at,
    p.last_active,
    p.login_count::bigint,
    p.active_days::bigint,
    p.sessions::bigint
  from per_user p
  left join auth.users u on u.id = p.uid
  order by p.last_active desc nulls last;
end;
$$;

create or replace function public.usage_feature_rows(day_count integer default 7)
returns table (
  feature text,
  unique_users bigint,
  usage_count bigint,
  adoption_rate numeric,
  last_used timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := public.usage_period_days(day_count);
  period_start timestamptz := now() - make_interval(days => days);
  base_users numeric;
begin
  if not public.usage_can_read() then
    return;
  end if;

  select count(distinct e.user_id)::numeric into base_users
  from public.usage_events e
  where e.event_timestamp >= period_start
    and public.usage_is_meaningful(e.event_name);

  return query
  with catalog(feature, event_name) as (
    values
      ('Home', 'home_viewed'),
      ('Search', 'searched'),
      ('Filters', 'filtered'),
      ('List', 'list_viewed'),
      ('Export', 'export_completed'),
      ('Admin', 'admin_viewed')
  )
  select
    c.feature,
    count(distinct e.user_id)::bigint,
    count(*)::bigint,
    case when coalesce(base_users, 0) = 0 then null
      else round(100.0 * count(distinct e.user_id) / base_users, 1)
    end,
    max(e.event_timestamp)
  from catalog c
  left join public.usage_events e
    on e.event_name = c.event_name
   and e.event_timestamp >= period_start
  group by c.feature
  order by c.feature;
end;
$$;

create or replace function public.usage_error_rows(day_count integer default 7)
returns table (
  event_timestamp timestamptz,
  email text,
  branch text,
  module text,
  page text,
  event_name text,
  error_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days integer := public.usage_period_days(day_count);
begin
  if not public.usage_can_read() then
    return;
  end if;

  return query
  select
    e.event_timestamp,
    u.email::text,
    e.branch,
    e.module,
    e.page,
    e.event_name,
    e.metadata ->> 'error_code'
  from public.usage_events e
  left join auth.users u on u.id = e.user_id
  where e.event_timestamp >= now() - make_interval(days => days)
    and e.event_name in ('error_occurred', 'export_failed', 'access_denied')
  order by e.event_timestamp desc
  limit 50;
end;
$$;

revoke all on function public.usage_company(integer) from public;
revoke all on function public.usage_daily_rows(integer) from public;
revoke all on function public.usage_user_rows(integer) from public;
revoke all on function public.usage_feature_rows(integer) from public;
revoke all on function public.usage_error_rows(integer) from public;
grant execute on function public.usage_company(integer) to authenticated;
grant execute on function public.usage_daily_rows(integer) to authenticated;
grant execute on function public.usage_user_rows(integer) to authenticated;
grant execute on function public.usage_feature_rows(integer) to authenticated;
grant execute on function public.usage_error_rows(integer) to authenticated;
