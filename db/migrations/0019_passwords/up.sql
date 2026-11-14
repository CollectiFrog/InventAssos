-- Password sign-in next to the e-mail link (ADR 0029, US-0.10.8). Only a scrypt hash is stored; a
-- password is chosen through a reset link, a sign-in token with its own purpose.
alter table users add column password_hash text;
alter table sign_in_tokens add column purpose text not null default 'sign_in';
alter table sign_in_tokens add constraint sign_in_tokens_purpose_ck
  check (purpose in ('sign_in', 'password_reset'));
