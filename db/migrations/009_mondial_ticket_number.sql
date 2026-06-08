alter table mondial_inscriptions add column if not exists ticket_number text;

create unique index if not exists mondial_inscriptions_ticket_number_idx
  on mondial_inscriptions (ticket_number)
  where ticket_number is not null;
