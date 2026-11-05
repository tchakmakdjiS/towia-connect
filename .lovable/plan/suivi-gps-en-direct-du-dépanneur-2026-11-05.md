# Suivi GPS en direct du dépanneur

## Constat actuel
- Aucune carte interactive : le client n'a qu'un lien vers OpenStreetMap.
- La position du dépanneur est une seule position « dernière connue » sur sa fiche, mise à jour à la main depuis son tableau de bord.
- Problème de confidentialité : la page mission du client lit cette position directement sur la fiche du dépanneur, en dehors de toute intervention.
- Le temps réel (Realtime) est déjà actif sur missions, historique et notifications.

## Ce qui sera ajouté

### Espace dépanneur (page mission)
- Bouton « Démarrer le suivi GPS » visible dès que la mission est acceptée (Acceptée, En route, Arrivé, Intervention).
- Envoi de la position toutes les 4 secondes environ, seulement si le dépanneur a bougé d'au moins 15 m (économie de batterie et de données).
- Badge « Position partagée » avec l'heure du dernier envoi.
- Arrêt automatique quand la mission passe à Terminée ou Annulée, ou quand il quitte la page.
- Messages clairs si le GPS est refusé, et reprise automatique après une coupure réseau (la dernière position est renvoyée au retour du réseau).

### Espace client (détail de l'intervention)
- Carte interactive (Leaflet + fond OpenStreetMap, gratuit, sans clé) avec l'icône camion du dépanneur et le point du client.
- Déplacement fluide du camion à chaque nouvelle position, sans recharger.
- Itinéraire routier, distance restante et heure d'arrivée estimée (service d'itinéraire gratuit OSRM ; à défaut, ligne droite + estimation).
- Si le suivi est interrompu : « Dernière position reçue le … à … ».
- La carte disparaît une fois la mission terminée ou annulée.

## Sécurité et confidentialité
- Nouvelle table dédiée aux positions de suivi, liée à une mission (une ligne par mission, écrasée à chaque envoi — pas d'historique de trajet).
- Seul le dépanneur affecté peut écrire, et uniquement tant que la mission est en cours (contrôlé par la base).
- Lecture : le client de la mission, l'entreprise de la mission, le dépanneur affecté et l'admin. Personne d'autre, même en changeant l'adresse.
- Le temps réel respecte ces mêmes règles : un client ne reçoit jamais la position d'un autre dépanneur.
- La position est supprimée automatiquement à la clôture de la mission.
- La page client ne lira plus la position depuis la fiche du dépanneur.

## Ce qui ne change pas
Statuts de mission, dispatch, devis, paiements, factures, synchronisation, bouton « Ouvrir dans Maps/Waze ».

## Tests prévus
- Deux comptes (client test + dépanneur test) : démarrer le suivi avec une position simulée, déplacer la position, vérifier que le camion bouge côté client.
- Terminer la mission : vérifier l'arrêt du partage et la disparition de la carte.
- GPS refusé et coupure réseau simulés dans le navigateur de test.
- Un autre client tente de lire la position : accès refusé.

## Détails techniques
- Table `mission_live_locations(mission_id pk, operator_id, latitude, longitude, heading, speed, accuracy, updated_at)` + GRANT + RLS ; écriture via upsert contrôlé par politique (`my_operator_id(auth.uid()) = missions.operator_id` et statut dans ACCEPTED..IN_PROGRESS) ; trigger sur `missions` qui supprime la ligne à COMPLETED/CANCELLED ; ajout à la publication `supabase_realtime`.
- Hook `useLiveLocationSharing` (`watchPosition`, throttle 4 s / 15 m, `enableHighAccuracy`, file d'attente online/offline) ; composant `LiveTrackingMap` chargé via `React.lazy` + `ClientOnly` (Leaflet hors SSR), canal Realtime unique par montage, nettoyé au démontage.
- Retrait de `last_latitude/last_longitude` de la requête client.
- Android/iOS : la géolocalisation passe par le navigateur intégré (Capacitor), déclarations d'usage déjà listées dans MOBILE.md. Le suivi s'arrête si l'appli passe en arrière-plan (limite connue, sans plugin natif).
