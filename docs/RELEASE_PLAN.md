# Plan de mise en production — Transporteur VTC

## Étape 0 — Préparation
- Confirmer la structure juridique et le rôle exact de Transporteur (opérateur / intermédiaire).
- Valider contrats partenaires, CGU/CGV, politique d'annulation et barème de commission.
- Vérifier domaine, marque et disponibilité des noms d'applications.
- Définir les justificatifs obligatoires et le processus de contrôle chauffeur/véhicule.

## Étape 1 — Socle technique
- Déployer PostgreSQL avec sauvegardes chiffrées.
- Déployer l'API derrière HTTPS.
- Ajouter authentification robuste, rôles et journal d'audit.
- Ajouter migrations, tests unitaires et pipeline CI.

## Étape 2 — Applications
- Client : inscription, adresse, devis, réservation, suivi, reçu.
- Chauffeur : dossier, validation, disponibilité, acceptation, navigation, fin de course.
- Admin : contrôle des dossiers, dispatch, tarifs, annulations, remboursements et reporting.
- Traductions françaises et anglaises.

## Étape 3 — Fournisseurs externes
- Cartographie : géocodage, itinéraires et estimation de durée.
- Paiement : prestataire adapté aux plateformes, onboarding et vérifications des bénéficiaires.
- Notifications : push, e-mail et SMS selon consentements et besoins.
- Stockage privé des documents avec accès limité et liens temporaires.

## Étape 4 — Pilote privé
- Inviter un petit groupe de chauffeurs vérifiés.
- Tester des courses fictives puis des courses réelles autorisées.
- Vérifier prix affiché, montant encaissé, commission et versement.
- Tester annulation, incident, absence chauffeur, remboursement et support.
- Recueillir les retours et corriger les problèmes bloquants.

## Étape 5 — Publication
- Tests de sécurité, confidentialité et charge.
- Conditions d'utilisation, politique de confidentialité et support accessibles.
- Comptes Apple Developer et Google Play Console.
- Fiches magasins, captures d'écran, classification et soumission.
- Déploiement progressif, monitoring et procédure de retour arrière.

## Critères de sortie du pilote
- Aucun chauffeur activé sans contrôle documentaire requis.
- Aucun paiement ou transfert sans rapprochement et journalisation.
- Devis identique au tarif confirmé, sauf règle explicitement acceptée.
- Parcours d'annulation et support opérationnels.
- Sauvegarde restaurée lors d'un exercice.
- Aucune vulnérabilité critique ouverte.
