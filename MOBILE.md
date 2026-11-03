# TowIA — Applications mobiles

## PWA (déjà actif)
Ouvrir https://towia-connect.lovable.app sur le téléphone :
- Android (Chrome) : menu ⋮ → « Installer l'application ».
- iOS (Safari) : Partager → « Sur l'écran d'accueil ».

## Android / iOS natifs (Capacitor, coque autour du site publié)
`capacitor.config.json` charge https://towia-connect.lovable.app : toute mise à jour publiée arrive sans republier sur les stores.

Sur votre ordinateur (après export GitHub, Node 20+, Android Studio / Xcode sur Mac) :
```
npm install
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
npx cap sync
npx cap open android   # Build > Generate Signed Bundle (AAB) pour Google Play
npx cap open ios       # Product > Archive pour l'App Store
```
Permissions à déclarer : localisation (AndroidManifest / Info.plist NSLocationWhenInUseUsageDescription), micro (NSMicrophoneUsageDescription), caméra/photos (NSCameraUsageDescription, NSPhotoLibraryUsageDescription).
