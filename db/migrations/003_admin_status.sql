alter table adhesions add column if not exists status text not null default 'pending' check (status in ('pending', 'validated', 'rejected'));
alter table adhesions add column if not exists admin_notes text;

alter table contact_messages add column if not exists status text not null default 'unread' check (status in ('unread', 'read', 'replied'));
alter table contact_messages add column if not exists admin_notes text;
