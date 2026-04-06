-- Create system_logs table for observability
create table if not exists public.system_logs (
  id uuid default gen_random_uuid() primary key,
  level text not null check (level in ('info', 'warning', 'error')),
  category text not null check (category in ('performance', 'error', 'usage', 'security')),
  action text not null,
  duration_ms integer,
  message text,
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.system_logs enable row level security;

-- Policies: Authenticated users can insert logs, Admins can view all
create policy "Allow authenticated to insert logs"
  on public.system_logs for insert with check (auth.role() = 'authenticated');

create policy "Allow admins to select logs"
  on public.system_logs for select using (
    exists (
      select 1 from public.employees
      where id = auth.uid() and role = 'ADMIN'
    )
  );

-- Create a view for quick metrics analysis
create or replace view public.view_performance_metrics as
select 
  action,
  count(*) as total_calls,
  avg(duration_ms) as avg_duration,
  max(duration_ms) as max_duration,
  percentile_cont(0.95) within group (order by duration_ms) as p95_duration
from public.system_logs
where category = 'performance' and duration_ms is not null
group by action;

create or replace view public.view_daily_usage as
select 
  date_trunc('day', created_at) as day,
  category,
  count(*) as total_events
from public.system_logs
group by 1, 2;
