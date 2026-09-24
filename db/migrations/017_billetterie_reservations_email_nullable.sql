-- Migration: rendre la colonne email optionnelle (nullable) dans billetterie_reservations
alter table billetterie_reservations
  alter column email drop not null;
