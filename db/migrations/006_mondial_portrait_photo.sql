do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'justificatifs_identite_type_document_check'
      and conrelid = 'justificatifs_identite'::regclass
  ) then
    alter table justificatifs_identite
      drop constraint justificatifs_identite_type_document_check;
  end if;
end $$;

alter table justificatifs_identite
  add constraint justificatifs_identite_type_document_check
  check (type_document in ('PASSPORT', 'DRIVER_LICENSE', 'PHOTO'));
