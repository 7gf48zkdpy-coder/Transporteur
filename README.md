<p align="center"><img src="icon.svg" width="120" alt="Transporteur"></p>

# Transporteur VTC

Plateforme VTC privée en Île-de-France, construite sur le starter VOLT VTC.

## Ce qui est en ligne (dossier `web/`)
Site publié par Netlify à chaque modification de la branche `main` :
- **Appli client** (`index.html`) : compte, adresse de départ/arrivée, prix garanti par véhicule (Berline, Électrique, Van),
  réservation immédiate ou à l'avance, paiement **à bord** ou **par carte** (Stripe), suivi du chauffeur sur la carte, annulation, note.
- **Espace chauffeur** (`chauffeur.html`) : inscription, véhicule, envoi des 8 justificatifs, disponibilité, courses à accepter,
  « Je pars » → « Client à bord » → « Terminer », gains et commission due.
- **Admin** (même page, compte ADMIN) : vérification des documents, validation / suspension des chauffeurs, toutes les courses.
- Français / anglais, installable sur l'écran d'accueil (PWA). Icônes PNG générées depuis `icon.svg` par `web/build-icons.js`.

Règles métier : commission plateforme 15 %, course minimum 10 €, prix calculé par le serveur (distance + durée ou forfait).

## Base de données et serveur
Projet Supabase `transporteur` (Paris). Les règles (tarifs, cycle de course, droits d'accès) sont dans la base ;
la dernière évolution pour l'appli web est dans `supabase/migrations/20261030000007_web_app.sql`.
Le paiement par carte nécessite les secrets Stripe dans Supabase (Edge Functions → Secrets) :
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Sans eux, l'appli propose le paiement à bord.

## Starter VOLT (développement)
- `backend/` API Node.js / Express / TypeScript avec moteur tarifaire (`npm run dev`, port 4000)
- `database/` schéma SQL initial
- `apps/` squelettes des futures applis natives (client, chauffeur, admin)
- `docs/` politique tarifaire et plan de mise en production

```bash
cd backend && cp .env.example .env && npm install && npm run dev
curl -X POST http://localhost:4000/api/pricing/quote -H "Content-Type: application/json" \
  -d '{"vehicle":"BERLINE","distanceKm":12,"durationMinutes":25}'
```

## Avant d'ouvrir au public
Contrats partenaires, CGV et politique d'annulation, assurance et contrôle des documents VTC, RGPD,
sauvegardes et procédure d'incident (voir `docs/RELEASE_PLAN.md`).
