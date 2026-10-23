# Réception colis GMP — mise en place

Pages :

- `index.html` — accueil (deux gros boutons).
- `reception.html` — **opérateurs** : tuiles de commandes, recherche, filtre par fournisseur et par personne, sélection de plusieurs commandes, validation (complète / incomplète, nombre de colis reçus, intact / abîmé, lieu de mise à disposition) → un e-mail part au commandeur.
- `admin.html` — **administration** (compte requis) : toutes les commandes et réceptions (filtres, recherche, statut du mail, photo), **export Excel** de la vue filtrée, **modification** (✏️) ou **annulation** (↩️) d'une réception, suppression d'une ligne, édition des **fournisseurs courants** et de la **liste des opérateurs**.
- `photo.html` — page ouverte par le QR code sur le téléphone de l'opérateur (photo de la réception).
- `commande.html` — **commandeur** : déclare sa commande (nom, e-mail, fournisseur, contenu, n° de commande), retrouve ses commandes et leur état, peut annuler.

Aucun contrôle d'accès sur l'accueil, la réception et la commande (choix demandé) ; seule l'administration demande un compte. Les adresses e-mail ne sont jamais renvoyées aux pages publiques : seul le commandeur les retrouve en saisissant la sienne.

## Annuler à chaque étape

| Étape | Annulation |
|---|---|
| Choix de la commande (appui long, sélection multiple) | **Annuler la sélection** |
| Colis non déclaré (choix du destinataire) | **Annuler** |
| Fenêtre de validation de la réception | **Annuler** (une commande ouverte d'un simple appui ne reste pas sélectionnée) |
| **Réception enregistrée** (QR code / photo, mails pas encore partis) | **↩ Annuler la réception** : les commandes redeviennent « attendues » ; un colis non déclaré saisi par l'opérateur est supprimé |
| Photo avec la caméra de l'appareil | **Annuler** (retour à l'étape précédente), **🔄 Reprendre** |
| Photo sur le téléphone (QR code) | **Annuler**, **Reprendre** |
| Après l'envoi des mails | impossible à l'écran de réception (voir l'admin : ✏️ modifier, ↩️ annuler la réception) |

## Photo de la réception (QR code)

**Deux façons de prendre la photo** : soit en scannant le QR code avec un téléphone, soit avec **la caméra de l'appareil qui affiche l'appli** (bouton **📷 Prendre la photo avec cet appareil**) : aperçu en direct, 📸 prendre la photo, vérifier, 🔄 reprendre ou ✅ valider et envoyer. Si la caméra est indisponible ou refusée, le bouton propose de **choisir une photo dans les fichiers**. La caméra demande l'autorisation du navigateur à la première utilisation (page en HTTPS obligatoire, ce qui est le cas sur GitHub Pages).

Rappel du principe :

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

## Affichage des commandes (réception)

- **Tuiles** (par défaut) : un bandeau de la **couleur du fournisseur** (avec son logo s'il en a un) puis le nom, le contenu en plus petit, le n° de commande et la date.
- **Liste** : le bouton **☰ Liste** / **▦ Tuiles** à côté de « Effacer » bascule vers une ligne par commande (plus dense) ; le choix est mémorisé.
- **Couleur et logo des fournisseurs** : dans `admin.html`, onglet « Fournisseurs courants » : sélecteur de couleur, « Ajouter un logo » (image réduite automatiquement à 160 × 80 px, environ 5 à 20 Ko), « Retirer le logo », « ↺ couleur » pour revenir à la couleur automatique, puis **Enregistrer la liste**. Tant qu'aucune couleur n'est choisie, chaque fournisseur de la liste reçoit une couleur automatique différente. Un fournisseur saisi à la main et absent de la liste reçoit une couleur automatique : pour le personnaliser, ajoutez-le à la liste (même orthographe, sans tenir compte des majuscules ni des accents).
- **✏️ Renommer** (admin, onglet « Fournisseurs courants ») : change le nom d'un fournisseur dans la liste **et dans toutes les commandes existantes** ; la couleur et le logo suivent. Si le nouveau nom existe déjà, les deux fournisseurs sont **fusionnés** (utile pour corriger une faute de frappe). Les mails déjà envoyés ne changent pas.
- Cette version ajoute la migration `1791000004_config_logos.js` : **redémarrer PocketBase** après la mise à jour.

## Date de réception prévue

- Dans « J'attends une commande », le commandeur peut indiquer (facultatif) la **date à laquelle il attend sa commande**.
- À l'écran de réception, **le jour même**, la tuile (ou la ligne en vue liste) est entourée d'un **halo bleu** et affiche « attendue aujourd'hui » ; les autres jours elle affiche « prévue le jj/mm/aaaa ». La date du jour est celle du poste de réception.
- La date prévue figure aussi dans l'admin (colonne « Prévue le ») et dans l'export Excel.
- Cette version ajoute la migration `1791000005_date_prevue.js` : après la mise à jour, **redémarrer PocketBase** (`sudo systemctl restart pocketbase-colis`).

## Commande en retard

Une commande encore **attendue** dont la date prévue est **dépassée** a un contour **orange** et affiche « en retard de N j (prévue le jj/mm/aaaa) » (tuiles et liste).

## Colis non déclaré (réception)

Bouton **＋ Colis non déclaré**, dans la barre de recherche de l'écran de réception :
1. L'opérateur choisit le **destinataire dans la liste des personnes connues** (celles qui ont déjà déclaré une commande ; recherche au clavier à l'écran). Leur adresse e-mail n'est jamais affichée : le serveur la retrouve et le mail part normalement. Si la personne n'est pas dans la liste, il saisit son nom (**aucun mail** n'est alors envoyé).
2. Il indique le fournisseur et le contenu (facultatifs, « Non précisé » par défaut).
3. La fenêtre habituelle de validation s'ouvre (colis reçus, état, lieu, opérateur, commentaire), puis le QR code de la photo. Si l'opérateur abandonne à cette étape, la fiche créée est supprimée.
Le colis apparaît avec le repère « non déclaré » et, dans l'admin, une pastille « non déclarée » (et « Sans e-mail » si le destinataire n'a pas d'adresse).

## Modifier une commande attendue (admin)

Bouton ✏️ sur chaque ligne « Attendue » : prénom, nom, **adresse e-mail**, fournisseur, n° de commande, contenu, date prévue.

- Cette version ajoute la migration `1791000006_non_declare.js` : **redémarrer PocketBase** après la mise à jour (`sudo systemctl restart pocketbase-colis`).

## Disposition de l'écran de réception

- **Colonne de filtres à gauche** : une liste verticale de **fournisseurs** (point de couleur et nombre de commandes) puis de **personnes** en attente de commande, avec de grandes zones à toucher. Elle reste affichée pendant qu'on fait défiler les tuiles et défile seule quand il y a beaucoup de personnes. Toucher un élément filtre, le retoucher retire le filtre ; **Effacer** remet tout à zéro.
- **À droite** : la recherche, les boutons (Effacer, ＋ Colis non déclaré, ☰ Liste, ⌨), les onglets « À réceptionner » / « Déjà réceptionnés », puis les tuiles.
- Sur un écran étroit (moins de 900 px), la colonne de filtres passe au-dessus de la recherche, en pastilles sur plusieurs lignes.

## Réceptionner une ou plusieurs commandes (écran tactile)

- **Un appui** sur une commande ouvre directement la fenêtre de réception (colis reçus, état, lieu, opérateur…) : plus besoin de cocher puis de valider.
- **Un appui long** (environ une demi-seconde) sur une commande lance la **sélection multiple** : des **cases à cocher** apparaissent sur toutes les commandes, on touche celles à ajouter, puis **Valider la réception →** en bas. **Annuler la sélection** (ou décocher la dernière commande) revient au mode normal.
- Un appui long marche aussi en vue liste.

## Zoom de l'écran de réception

La position **nominale est affichée « 100 % »** (réglage par défaut, au centre du curseur) ; le curseur va de **70 à 130 %** (± 30 % autour du nominal). Le bouton qui affiche le pourcentage ramène à 100 %.

**Le niveau nominal s'adapte à l'écran** : au chargement et quand la fenêtre change de taille, l'appli mesure la hauteur disponible et choisit la taille d'affichage la plus grande (0,8 au maximum, 0,5 au minimum) qui laisse voir **deux rangées de commandes** sans faire défiler. Sur un grand écran, l'aspect reste celui d'avant ; sur un écran moins haut, tout est un peu plus petit. Le curseur de zoom (70 à 130 %) se règle toujours autour de ce niveau nominal.

Dans la barre du haut de `reception.html`, à côté du titre : un **curseur de zoom** avec les boutons **−** et **+**. Il agrandit ou réduit tout ce qui est sous la barre (tuiles, filtres, fenêtres de validation) ; le réglage est mémorisé sur le poste. La barre du haut reste fixe en haut de l'écran.

## Lieux de dépôt (admin)

- Onglet « Lieux de dépôt » : ajouter, retirer, **✏️ Renommer** (met aussi à jour les réceptions déjà enregistrées ; fusion si le nom existe déjà), puis **Enregistrer la liste**.
- Ils s'affichent en gros boutons sur l'écran de réception et dans le mail au commandeur. Tant qu'aucune liste n'est enregistrée, la liste de `config.js` est utilisée.

## Mails au commandeur

- Le fournisseur apparaît **en gras**, précédé de son **logo** s'il en a un (le logo est servi par `/colis/logo`, affiché si le logiciel de messagerie charge les images distantes ; le champ « Application URL » de PocketBase doit être renseigné).
- La date de réception est au format **jj/mm/aaaa à hh:mm**, heure de Paris.
- Aucun emoji hors ✅ et ⚠️ : certains logiciels de messagerie affichent les autres (📦 📍 💬) en carrés vides.

## Opérateurs (admin)

- Onglet « Opérateurs » : une ligne par opérateur, comme pour les fournisseurs.
- **✏️ Renommer** : change le nom dans la liste **et dans toutes ses réceptions passées** ; si le nouveau nom existe déjà, les deux sont fusionnés.
- **Émoticone** : le carré à gauche ouvre une palette (ou collez le vôtre : Windows + point). Il s'affiche sur le bouton de l'opérateur à la réception. Pensez à **Enregistrer la liste**.
- Le numéro de version s'affiche sous le titre de chaque page ; il se change dans `app.js` (`const VERSION`).

## Corriger ou annuler une réception (admin)

- **✏️ Modifier** : complète / incomplète, nombre de colis, intact / abîmé, lieu, opérateur, commentaire. Aucun nouveau mail n'est envoyé au commandeur.
- **↩️ Annuler la réception** : la commande redevient « attendue » et réapparaît chez les opérateurs. Le mail déjà parti ne peut pas être rappelé. La photo est supprimée, sauf si elle sert encore à une autre commande du même lot.
- Cette version ajoute la migration `1791000003_admin_edit.js` (droit de modification pour les administrateurs) : **redémarrer PocketBase** après la mise à jour (voir `GUIDE-POCKETBASE.md`).

## Photos : place occupée

- La photo est **réduite sur le téléphone avant l'envoi** (1280 px, JPEG qualité 70 % : environ 150 à 250 Ko), et PocketBase refuse tout fichier de plus de 3 Mo.
- **Une seule photo par lot** de commandes validées ensemble (pas une par commande).
- L'onglet « Déjà réceptionnés » affiche une **miniature légère** (≈ 20 Ko, générée par PocketBase) ; toucher la photo l'ouvre en grand.
- **Les fichiers photo sont supprimés au bout de 30 jours** (la fiche de commande reste), et la fiche elle-même au bout de 90 jours. Réglable dans `pb/pb_hooks/colis-lib.js` (`JOURS_PHOTO`, `JOURS_PURGE`).
- Ordre de grandeur : 100 réceptions par mois avec photo ≈ 20 Mo à conserver.

## Écran tactile de réception

- **Clavier à l'écran** : s'ouvre dès qu'une zone de texte est touchée sur `reception.html` (recherche, commentaire, nom d'opérateur). Actif par défaut sur un écran tactile ; le bouton **⌨** à côté de « Effacer » l'active ou le désactive (choix mémorisé). Forçable avec `?clavier=1` ou `?clavier=0` dans l'adresse.
- **Opérateurs** : la liste se règle dans `admin.html` (onglet « Opérateurs ») ; elle s'affiche en gros boutons, avec « ✏️ Autre… » pour saisir un nom à la main.

## Personnaliser

- **Lieux de mise à disposition** : liste en haut de `config.js`.
- **Fournisseurs courants** : à modifier dans `admin.html` (onglet « Fournisseurs courants ») ; la liste de `config.js` ne sert que de secours.
- Réceptions visibles 7 jours dans l'onglet « Déjà réceptionnés », supprimées au bout de 90 jours (constantes dans `pb/pb_hooks/colis-lib.js`).

## À savoir

- Sans contrôle d'accès, n'importe qui connaissant l'adresse pourrait déclarer ou valider un colis. Pour limiter les abus, activer dans PocketBase *Settings → Application → Rate limiting*.
- Un colis arrivé **sans avoir été déclaré** ne peut pas être validé (il faut une adresse e-mail à prévenir) : le commandeur doit le déclarer, puis l'opérateur le valide.
