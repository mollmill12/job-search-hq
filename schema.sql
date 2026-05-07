-- Jobs table
create table if not exists jobs (
  id bigint primary key,
  company text not null,
  title text,
  status text default 'Phone Screen',
  location text,
  salary text,
  url text,
  notes text,
  date_added date default current_date,
  contacts bigint[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contacts table
create table if not exists contacts (
  id bigint primary key,
  name text not null,
  company text,
  role text,
  email text,
  linkedin text,
  notes text,
  job_ids bigint[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Follow-ups table
create table if not exists follow_ups (
  id bigint primary key,
  job_id bigint references jobs(id) on delete cascade,
  text text not null,
  due_date date,
  done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Interviews table
create table if not exists interviews (
  id bigint primary key,
  job_id bigint references jobs(id) on delete cascade,
  round text,
  date date,
  notes text,
  outcome text default 'Pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sync log (tracks last Gmail/Calendar sync)
create table if not exists sync_log (
  id serial primary key,
  synced_at timestamptz default now(),
  emails_processed int default 0,
  events_processed int default 0,
  updates_made text[] default '{}',
  error text
);

-- Google tokens (stores OAuth refresh token)
create table if not exists google_tokens (
  id serial primary key,
  access_token text,
  refresh_token text,
  expiry timestamptz,
  updated_at timestamptz default now()
);

-- Seed initial data
insert into jobs (id, company, title, status, location, notes) values
  (101, 'AWS', 'Business Operations Manager, SMGS', 'Interviewing', 'Atlanta, GA (Remote-friendly)', 'Had informational with Julie (recruiter). Targeting Business Ops role supporting SMGS/AGS org under Rich Giraffo. Role owns rhythm of business: target setting (IPMM), pipeline inspection, live business reviews, and weekly exec summary for WBR. Next step: fill out internal application to kick off loop. Zach is also recruiting for this req.'),
  (102, 'Google', 'TBD', 'Phone Screen', '', ''),
  (103, 'Microsoft', 'Multiple roles applied', 'Rejected', '', 'Rejected: Director, Customer Success Account Management (Apr 20). Rejected: Experience Lead, AI Acceleration Program (Apr 15).'),
  (104, 'Cox Automotive', 'TBD', 'Phone Screen', 'Atlanta, GA', ''),
  (105, 'NexusOne', 'TBD', 'Phone Screen', '', ''),
  (106, 'Workday', 'Revenue Programs or Revenue Activation (TBD)', 'Phone Screen', 'Remote / Atlanta, GA', 'Informational with Julie Robinson (SVP Revenue Strategy & Ops). Team of ~70: Revenue Strategy & Ops, Revenue Programs, Revenue Insights, Revenue Activation. Best fit: Revenue Programs and Revenue Activation. No open reqs right now — full boat — but Julie keeping top of mind. Key intro: Kerry Huskey — Federal/Public Sector, Atlanta. Follow up in 3-4 weeks.'),
  (107, 'Honeywell', 'Sr Director Strategic Planning (LinkedIn alert)', 'Phone Screen', 'Atlanta, GA', 'LinkedIn job alert received Apr 15. No application yet.')
on conflict (id) do nothing;

insert into contacts (id, name, company, role, email, notes, job_ids) values
  (101, 'Julie', 'AWS', 'Recruiter', '', 'Led informational. Open to Atlanta. Will assign interviewers once application submitted. Zach also recruiting.', '{101}'),
  (102, 'Julie Robinson', 'Workday', 'SVP Revenue Strategy & Ops', 'julie.robinson@workday.com', 'Led Workday informational. No open reqs but keeping top of mind. Will intro to Kerry Huskey. Check back 3-4 weeks.', '{106}'),
  (103, 'Kerry Huskey', 'Workday', 'Revenue Strategy & Ops — Federal/Public Sector', 'kerry.huskey@workday.com', 'Based in Atlanta. Leads federal/public sector revenue ops. Julie Robinson making intro.', '{106}')
on conflict (id) do nothing;

insert into follow_ups (id, job_id, text, due_date, done) values
  (201, 101, 'Submit internal application (informational form) to kick off interview loop', '2026-04-16', false),
  (202, 101, 'Complete interview loop before internal access expires (2 weeks)', '2026-04-29', false),
  (203, 106, 'Follow up with Julie Robinson at Workday — check on open reqs', '2026-05-12', false),
  (204, 106, 'Meet Kerry Huskey (Workday, Federal, Atlanta) — Julie making intro', '2026-05-05', false),
  (205, 106, 'Research Workday Revenue Programs and Revenue Activation — prep talking points', '2026-04-28', false),
  (206, 107, 'Apply to Sr Director Strategic Planning at Honeywell (LinkedIn alert Apr 15)', '2026-04-28', false)
on conflict (id) do nothing;

-- Enable Row Level Security (open for now since it's personal use)
alter table jobs enable row level security;
alter table contacts enable row level security;
alter table follow_ups enable row level security;
alter table interviews enable row level security;
alter table sync_log enable row level security;
alter table google_tokens enable row level security;

-- Allow all operations with anon key (personal app)
create policy "Allow all" on jobs for all using (true) with check (true);
create policy "Allow all" on contacts for all using (true) with check (true);
create policy "Allow all" on follow_ups for all using (true) with check (true);
create policy "Allow all" on interviews for all using (true) with check (true);
create policy "Allow all" on sync_log for all using (true) with check (true);
create policy "Allow all" on google_tokens for all using (true) with check (true);
