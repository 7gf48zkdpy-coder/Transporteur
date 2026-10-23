// ============================================================
//  Configuration Transporteur
// ============================================================

// Base de données Supabase (projet « transporteur »).
// La clé « publishable » est faite pour être publique : les données sont
// protégées par les règles d'accès de la base (Row Level Security).
export const SUPABASE_URL = "https://zzkxkbvnhfhtdkpeljjz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_yFtcdcTEuDAAynPBYIUOpA_0PT_fks1";

// Clé publique des notifications (la clé privée reste côté serveur)
export const VAPID_PUBLIC_KEY = "BPmFw9ck2Xq4iXFMvTcS8iHQ9jBm5c7RGAAVF5UD6O0BDIgkHZjc8ECflmcVgNNrRVYwVQggET6yHAQClqhDqL4";

// Valeurs de secours si les réglages ne sont pas encore chargés
// (les vraies valeurs se changent dans l'espace chauffeur > Réglages)
export const DEFAULT_SETTINGS = {
  // Coordonnées bancaires : enregistrées dans la base (Réglages), pas dans le code
  titulaire: "", iban: "", bic: "", banque: "", revtag: "",
  tarif: {
    // jusqu'à X km → prix au km ; la dernière ligne (upto: null) = au-delà
    tiers: [
      { upto: 10, rate: 1.60 },
      { upto: 25, rate: 1.45 },
      { upto: 50, rate: 1.30 },
      { upto: 80, rate: 1.20 },
      { upto: null, rate: 1.10 }
    ],
    min: 0,          // prix minimum d'une course (€)
    approche: 20     // minutes d'approche offertes
  }
};
