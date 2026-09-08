# Towia: Your Roadside Ally

CRÉATION DU PROJET TOWIA — PLATEFORME INTELLIGENTE D'ASSISTANCE AUTOMOBILE

Je veux créer une application web/mobile responsive appelée :

TOWIA

Slogan :

"Votre assistance automobile, simplement."

OBJECTIF

TowIA est une plateforme qui met en relation automatiquement les automobilistes ayant besoin d'une assistance avec des professionnels du dépannage et du remorquage.

Le concept principal :

AUTOMOBILISTE

↓

SOS

↓

IA TOWIA

↓

ANALYSE DE LA DEMANDE

↓

LOCALISATION

↓

DISPATCH INTELLIGENT

↓

DÉPANNEUR

↓

SUIVI

↓

INTERVENTION

↓

PAIEMENT

↓

AVIS

==================================================

ARCHITECTURE TECHNIQUE

==================================================

Construire une architecture moderne et évolutive.

Utiliser :

- React

- TypeScript

- Tailwind CSS

- Supabase pour la base de données et l'authentification

- architecture compatible avec une API IA

- architecture compatible avec Stripe pour les paiements

- architecture compatible avec un service cartographique

NE PAS inventer de clés API.

Toutes les clés secrètes doivent rester côté serveur.

==================================================

DESIGN

==================================================

Créer une interface premium, moderne et professionnelle.

Style :

fond sombre

cartes modernes

orange TowIA comme couleur principale

contrastes élevés

boutons arrondis

icônes modernes

animations légères

mobile-first

Le design doit être adapté à une utilisation rapide depuis un smartphone.

L'application doit être responsive :

mobile

tablette

ordinateur

==================================================

RÔLES

==================================================

Créer quatre rôles :

CLIENT

OPERATOR

COMPANY

ADMIN

CLIENT :

Automobiliste utilisant TowIA pour demander une assistance.

OPERATOR :

Dépanneur intervenant sur les missions.

COMPANY :

Entreprise de dépannage pouvant gérer plusieurs dépanneurs et véhicules.

ADMIN :

Administration complète de la plateforme.

==================================================

AUTHENTIFICATION

==================================================

Utiliser Supabase Auth.

Créer :

Inscription

Connexion

Déconnexion

Mot de passe oublié

Gestion de session

Protection des routes

Gestion des rôles

Lors de l'inscription :

"Quel type de compte souhaitez-vous créer ?"

Afficher :

🚗 AUTOMOBILISTE

"Je cherche une assistance"

🛻 DÉPANNEUR

"Je propose mes services"

🏢 ENTREPRISE

"Je gère une équipe de dépannage"

==================================================

PAGES PRINCIPALES

==================================================

Créer les pages suivantes :

/

Landing page

/login

Connexion

/register

Inscription

/client/dashboard

Dashboard automobiliste

/client/sos

Demande SOS

/client/missions

Historique des missions

/client/mission/:id

Détail d'une mission

/client/profile

Profil automobiliste

/operator/dashboard

Dashboard dépanneur

/operator/missions

Missions disponibles

/operator/mission/:id

Détail mission

/operator/profile

Profil dépanneur

/company/dashboard

Dashboard entreprise

/company/missions

Missions entreprise

/company/operators

Équipe

/company/vehicles

Véhicules

/company/equipment

Équipements

/company/documents

Documents

/company/revenue

Revenus

/company/profile

Profil entreprise

/admin

Dashboard administrateur

/admin/missions

Gestion des missions

/admin/users

Utilisateurs

/admin/operators

Professionnels

/admin/companies

Entreprises

/admin/payments

Paiements

/admin/reviews

Avis

/admin/settings

Paramètres

==================================================

DASHBOARD CLIENT

==================================================

Afficher immédiatement :

"Besoin d'aide ?"

Gros bouton :

🚨 SOS ASSISTANCE

Sous le bouton :

"Un problème avec votre véhicule ? TowIA vous accompagne."

Afficher également :

Dernière mission

Missions en cours

Historique

Véhicules enregistrés

==================================================

SOS

==================================================

Le bouton SOS doit lancer un parcours intelligent.

Étape 1 :

demander la localisation.

Étape 2 :

demander :

"Que se passe-t-il ?"

Permettre :

conversation avec TowIA

boutons rapides

texte libre

photo

Catégories :

Panne

Remorquage

Batterie

Crevaison

Erreur carburant

Accident

Véhicule électrique

Autre

==================================================

IA TOWIA

==================================================

Préparer une architecture permettant à une IA de :

comprendre le problème

poser des questions

identifier la catégorie

identifier les besoins

identifier le véhicule

identifier la priorité

préparer un résumé pour le dépanneur.

L'IA ne doit jamais inventer :

prix

disponibilité

position

diagnostic certain

professionnel.

Créer une structure :

AIConversation

et :

MissionAIAnalysis

==================================================

MISSION

==================================================

Créer l'entité Mission.

Champs principaux :

id

client_id

operator_id

company_id

status

category

priority

description

vehicle_id

latitude

longitude

address

created_at

accepted_at

departure_time

arrival_at

completed_at

cancelled_at

Statuts :

CREATED

AI_ANALYSIS

SEARCHING

PROPOSED

ACCEPTED

EN_ROUTE

ARRIVED

IN_PROGRESS

COMPLETED

CANCELLED

DISPUTED

Priorités :

NORMAL

HIGH

EMERGENCY

==================================================

DÉPANNEUR

==================================================

Créer ou préparer :

TowOperator

Informations :

nom

prénom

téléphone

photo

disponibilité

note

zone d'intervention

services

équipements

véhicule

statut de vérification

==================================================

ENTREPRISE

==================================================

Créer :

Company

Informations :

nom

raison sociale

SIREN/SIRET

adresse

téléphone

email

logo

statut de vérification

zone d'intervention

Une entreprise peut posséder :

plusieurs dépanneurs

plusieurs véhicules

plusieurs équipements.

==================================================

DISPATCH

==================================================

Préparer un moteur de dispatch.

Le système devra sélectionner les professionnels selon :

disponibilité

distance

temps estimé

compatibilité véhicule

équipement

zone d'intervention

services proposés

qualité.

Créer :

MissionOffer

avec :

mission_id

operator_id

score

distance

estimated_arrival

status

offered_at

responded_at

expires_at

Statuts :

PENDING

ACCEPTED

DECLINED

EXPIRED

CANCELLED

==================================================

GÉOLOCALISATION

==================================================

Préparer l'intégration cartographique.

Le client doit pouvoir :

partager sa position

confirmer sa position

modifier sa position

Le dépanneur doit pouvoir :

voir la position du client

partager sa position pendant une mission

ouvrir la navigation.

NE PAS inventer de GPS réel sans API configurée.

==================================================

PAIEMENT

==================================================

Préparer l'intégration Stripe.

Créer :

Payment

Champs :

id

mission_id

client_id

operator_id

amount

currency

commission_rate

platform_fee

professional_amount

status

provider_payment_id

created_at

paid_at

refunded_at

Statuts :

PENDING

PROCESSING

PAID

FAILED

REFUNDED

CANCELLED

Prévoir une commission TowIA configurable.

Exemple de démonstration :

10 %

Ne pas considérer ce taux comme définitif.

NE PAS stocker les données bancaires.

==================================================

FACTURATION

==================================================

Créer :

Invoice

Champs :

id

mission_id

payment_id

invoice_number

client_id

operator_id

subtotal

tax_amount

total

currency

status

created_at

==================================================

AVIS

==================================================

Créer :

Review

Permettre au client de noter le professionnel après une mission terminée.

Note :

1 à 5 étoiles.

Critères :

Ponctualité

Professionnalisme

Rapidité

Qualité

Communication

==================================================

NOTIFICATIONS

==================================================

Préparer :

notifications internes

et architecture compatible avec :

push

email

SMS

Événements :

Mission créée

Dépanneur trouvé

Dépanneur en route

Dépanneur arrivé

Mission terminée

Paiement confirmé

Avis demandé.

==================================================

ADMINISTRATION

==================================================

Créer un dashboard administrateur permettant de voir :

utilisateurs

professionnels

entreprises

missions

paiements

avis

documents

statistiques.

Créer une interface de supervision moderne.

==================================================

SÉCURITÉ

==================================================

Utiliser Supabase Row Level Security.

CLIENT :

ne peut voir que ses propres données.

OPERATOR :

ne peut voir que ses missions et données autorisées.

COMPANY :

ne peut voir que ses employés, véhicules, équipements et missions autorisées.

ADMIN :

accès administratif.

Toutes les données sensibles doivent être protégées.

==================================================

MODE DEMO

==================================================

Créer un environnement DEMO permettant de tester :

client

dépanneur

entreprise

administrateur

Créer des données de démonstration clairement identifiées.

NE JAMAIS mélanger les données DEMO avec les données réelles.

==================================================

IMPORTANT

==================================================

NE PAS essayer de créer toutes les intégrations externes immédiatement.

Commencer par construire :

1. structure du projet

2. design

3. authentification

4. base de données

5. navigation

6. dashboards

7. parcours SOS

Créer une architecture propre et évolutive.

NE PAS créer de données fictives présentées comme réelles.

NE PAS inventer de clés API.

NE PAS inventer de paiements réels.

NE PAS inventer de positions GPS réelles.

À la fin, vérifier que le projet compile correctement et qu'il n'y a pas d'erreurs TypeScript ou de routes cassées.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://towia-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2dcca803-c083-4087-8bc0-cbc16de4d6d7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
