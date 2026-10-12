# Réception colis GMP — mise en place

Pages :

- `index.html` — accueil (deux gros boutons).
- `reception.html` — **opérateurs** : tuiles de commandes, recherche, filtre par fournisseur et par initiale du nom, sélection de plusieurs commandes, validation (complète / incomplète, nombre de colis reçus, intact / abîmé, lieu de mise à disposition) → un e-mail part au commandeur.
- `admin.html` — **administration** (compte requis) : toutes les commandes et réceptions (filtres, recherche, statut du mail, photo), **export Excel** de la vue filtrée, suppression d'une ligne, édition des **fournisseurs courants**.
- `photo.html` — page ouverte par le QR code sur le téléphone de l'opérateur (photo de la réception).
- `commande.html` — **commandeur** : déclare sa commande (nom, e-mail, fournisseur, contenu, n° de commande), retrouve ses commandes et leur état, peut annuler.

Aucun contrôle d'accès sur l'accueil, la réception et la commande (choix demandé) ; seule l'administration demande un compte. Les adresses e-mail ne sont jamais renvoyées aux pages publiques : seul le commandeur les retrouve en saisissant la sienne.

## Photo de la réception (QR code)

1. L'opérateur valide la réception sur le PC → un **QR code** s'affiche.
2. Il le scanne avec un téléphone → `photo.html` s'ouvre : **Prendre la photo**, puis **Valider et envoyer**, **Reprendre** ou **Annuler**.
3. À la validation, le mail part à chaque commandeur du lot **avec la photo** ; le PC affiche « ✅ Photo reçue, mails envoyés ».

Les mails ne partent donc qu'à cette étape. Si personne ne prend de photo : bouton **« Envoyer sans photo »** sur le PC, sinon envoi automatique sans photo **10 minutes** après la validation (constante `DELAI_PHOTO_MIN` dans `pb/pb_hooks/colis-lib.js`). Une même photo sert à toutes les commandes validées ensemble. Le téléphone doit pouvoir joindre l'adresse de l'appli et celle de PocketBase (wifi ou 4G, tout est en HTTPS public).

## Essayer tout de suite (mode démo)

Laissez `PB_URL` vide dans `config.js` et ouvrez `index.html` : tout marche, des commandes d'exemple sont fournies, et à la validation l'appli **affiche** le mail qui serait envoyé (rien ne part). Les données restent dans le navigateur.

## Mettre en ligne (PocketBase + GitHub Pages)

1. **Instance PocketBase dédiée** sur le Raspberry Pi (processus, port et dossier séparés des autres), avec un nouveau super-utilisateur.
2. Copier dans le dossier de cette instance :
   - `pb/pb_hooks/colis.pb.js` **et** `pb/pb_hooks/colis-lib.js` → dans `pb_hooks/`
   - `pb/pb_migrations/1791000000_colis.js` **et** `pb/pb_migrations/1791000001_admin.js` → dans `pb_migrations/`
3. **Redémarrer** PocketBase : les collections sont créées toutes seules.
4. **Réglage des e-mails** : tableau de bord PocketBase (`.../_/`) → *Settings → Mail settings* : renseigner l'adresse d'expéditeur, activer **SMTP** (serveur, port, identifiant, mot de passe), puis « Send test email » pour vérifier. Sans SMTP, les réceptions sont enregistrées mais l'appli prévient « mail non envoyé ».
5. Route **Cloudflare Tunnel** vers cette instance (ex. `api_colis.gmpbordeaux.fr`). Test : `https://api_colis.gmpbordeaux.fr/api/health`.
6. Dans `config.js`, mettre `window.PB_URL = "https://api_colis.gmpbordeaux.fr";`
7. Publier le dossier (sans `pb/` si vous voulez) sur un dépôt GitHub + **Settings → Pages**.
8. **Créer le compte administrateur** : tableau de bord PocketBase (`.../_/`, connexion super-utilisateur) → collection `colis_admins` → **New record** (e-mail, mot de passe, confirmation). Ce compte est propre à cette appli : celui du portail ne fonctionne pas ici. Se connecter ensuite sur `admin.html`.
9. Sur le PC de l'atelier : ouvrir `.../reception.html` et l'ajouter aux favoris / à l'écran d'accueil.

## Personnaliser

- **Lieux de mise à disposition** : liste en haut de `config.js`.
- **Fournisseurs courants** : à modifier dans `admin.html` (onglet « Fournisseurs courants ») ; la liste de `config.js` ne sert que de secours.
- Réceptions visibles 7 jours dans l'onglet « Déjà réceptionnés », supprimées au bout de 90 jours (constantes dans `pb/pb_hooks/colis-lib.js`).

## À savoir

- Sans contrôle d'accès, n'importe qui connaissant l'adresse pourrait déclarer ou valider un colis. Pour limiter les abus, activer dans PocketBase *Settings → Application → Rate limiting*.
- Un colis arrivé **sans avoir été déclaré** ne peut pas être validé (il faut une adresse e-mail à prévenir) : le commandeur doit le déclarer, puis l'opérateur le valide.
