-- Transporteur VTC — photo du véhicule (affichée au client pendant la course). Fichier rangé dans avatars/<id chauffeur>/.
alter table vehicles add column if not exists photo_url text;
