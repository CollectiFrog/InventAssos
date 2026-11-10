-- Fixed-window counters for the e-mail rate limits (ADR 0018). The key is a SHA-256 hash, so no
-- e-mail address, IP address or user ID is stored; rows are purged once their window has ended.
create table rate_limits (
  key_hash text primary key,
  hits integer not null,
  reset_at timestamptz not null
);

create index rate_limits_reset_at_idx on rate_limits (reset_at);
