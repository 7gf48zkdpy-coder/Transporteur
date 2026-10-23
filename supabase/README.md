# Base de données (Supabase)

Projet Supabase : `transporteur` (région Paris, eu-west-3), réf. `zzkxkbvnhfhtdkpeljjz`.

Tables :
- `settings` (1 ligne) : tarifs, IBAN, statut et position GPS du chauffeur. Lisible par tous, modifiable par le chauffeur.
- `clients` : prénom, nom, téléphone. Chaque client ne voit que sa fiche ; le chauffeur voit tout.
- `bookings` : réservations. Le client voit les siennes et peut seulement annuler une demande en attente ; le chauffeur voit et gère tout.
- `admins` : comptes chauffeur (non lisible depuis l'appli).

Règles d'accès : Row Level Security sur toutes les tables (voir les migrations dans le tableau de bord Supabase,
Database → Migrations : `transporteur_schema`, `revoke_trigger_function_exec`).

Connexions : clients en « connexion anonyme » (à activer dans Authentication → Sign In / Providers),
chauffeur par e-mail + mot de passe.
