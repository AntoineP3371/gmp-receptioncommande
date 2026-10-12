# Guide pas à pas : mettre PocketBase en route pour « Réception colis »

Objectif : une instance PocketBase **à part** (comme celles du portail et de Carnet SAE) sur votre Raspberry Pi, joignable en HTTPS par `https://api_colis.gmpbordeaux.fr`.

Temps estimé : 30 à 45 minutes. Vous aurez besoin de :
- l'accès SSH au Raspberry Pi (comme pour vos autres instances) ;
- l'accès au tableau de bord Cloudflare (Zero Trust) ;
- les identifiants SMTP d'un compte mail pour envoyer les notifications (voir étape 6).

Les commandes ci-dessous se tapent **dans le terminal du Raspberry Pi** (connexion SSH), sauf mention contraire.

---

## Étape 1 — Choisir un port libre et un dossier

Chaque instance PocketBase écoute sur son propre port. Regardez ceux déjà pris :

```bash
ss -tlnp | grep -i pocketbase
```

Notez les ports affichés (souvent 8090, 8091…). Dans la suite on utilise **8093** (8090, 8091 et 8092 sont déjà pris sur votre Pi) ; prenez un autre numéro s'il est déjà pris.

Créez le dossier de l'instance :

```bash
mkdir -p ~/pocketbase-colis && cd ~/pocketbase-colis
```

## Étape 2 — Télécharger PocketBase (même version que Carnet SAE)

Vérifiez l'architecture du Pi (elle doit afficher `aarch64`) :

```bash
uname -m
```

Puis téléchargez et dézippez (version 0.40.3, celle de Carnet SAE) :

```bash
wget https://github.com/pocketbase/pocketbase/releases/download/v0.40.3/pocketbase_0.40.3_linux_arm64.zip
unzip pocketbase_0.40.3_linux_arm64.zip
rm pocketbase_0.40.3_linux_arm64.zip
chmod +x pocketbase
./pocketbase --version
```

> Si `uname -m` affiche `armv7l`, remplacez `linux_arm64` par `linux_armv7` dans l'adresse. Si `wget` ou `unzip` manque : `sudo apt install -y wget unzip`.

## Étape 3 — Récupérer les fichiers de l'appli (depuis GitHub, rien à copier depuis le PC)

Le Pi télécharge lui-même les fichiers du dépôt (utile quand vous n'êtes pas chez vous) :

```bash
cd ~ && git clone https://github.com/AntoineP3371/gmp-receptioncommande.git colis-depot
cp -r ~/colis-depot/pb/pb_hooks ~/colis-depot/pb/pb_migrations ~/pocketbase-colis/
ls ~/pocketbase-colis/pb_hooks ~/pocketbase-colis/pb_migrations
```

Vous devez voir `colis.pb.js` et `colis-lib.js` d'un côté, `1791000000_colis.js` et `1791000001_admin.js` de l'autre. (Si `git` manque : `sudo apt install -y git`.)

**Pour mettre à jour plus tard** après une modification poussée sur GitHub :

```bash
cd ~/colis-depot && git pull && cp -r pb/pb_hooks pb/pb_migrations ~/pocketbase-colis/
```

> PocketBase recharge tout seul les fichiers de `pb_hooks` quand ils changent (aucun redémarrage ni `sudo` nécessaire). Les nouveaux fichiers de `pb_migrations` ne s'appliquent qu'au redémarrage : dans ce cas, arrêtez puis relancez PocketBase (voir l'aide-mémoire).

> Autre méthode (depuis le PC) : `scp -r pb_hooks pb_migrations UTILISATEUR@ADRESSE_DU_PI:~/pocketbase-colis/`, ou WinSCP.

## Étape 4 — Créer le super-utilisateur

C'est le compte qui donne accès au tableau de bord PocketBase (différent de ceux des autres instances). Choisissez un **vrai** mot de passe :

```bash
cd ~/pocketbase-colis
./pocketbase superuser upsert VOTRE_EMAIL VOTRE_MOT_DE_PASSE
```

## Étape 5 — Lancer PocketBase en service (démarre tout seul)

Créez le fichier de service :

```bash
sudo nano /etc/systemd/system/pocketbase-colis.service
```

Collez (remplacez `UTILISATEUR` par votre nom d'utilisateur sur le Pi, et `8093` si besoin) :

```ini
[Unit]
Description=PocketBase - Reception colis
After=network.target

[Service]
User=UTILISATEUR
WorkingDirectory=/home/UTILISATEUR/pocketbase-colis
ExecStart=/home/UTILISATEUR/pocketbase-colis/pocketbase serve --http=127.0.0.1:8093
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enregistrez (Ctrl+O, Entrée, puis Ctrl+X) et activez :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase-colis
sudo systemctl status pocketbase-colis
```

Le statut doit indiquer **active (running)**. Test local :

```bash
curl http://127.0.0.1:8093/api/health
```

Réponse attendue : `{"message":"API is healthy.", ...}`.
Au premier démarrage, les migrations créent toutes seules les collections `colis`, `colis_admins` et `colis_config`. En cas de souci : `journalctl -u pocketbase-colis -n 50`.

## Étape 6 — Régler l'envoi des e-mails (SMTP)

Sans cela, les réceptions sont enregistrées mais **aucun mail ne part**.

Le tableau de bord n'est pas encore accessible depuis Internet (étape 7). Refaites cette étape après, ou ouvrez-le via un tunnel SSH :

```powershell
ssh -L 8093:127.0.0.1:8093 UTILISATEUR@ADRESSE_DU_PI
```

puis, dans le navigateur du PC : `http://localhost:8093/_/`.

Dans le tableau de bord (connexion avec le super-utilisateur de l'étape 4) :
1. **Settings → Application** : champ « Application URL » = `https://api_colis.gmpbordeaux.fr`.
2. **Settings → Mail settings** : renseignez « Sender name » (ex. *Réception colis GMP*) et « Sender address » (l'adresse d'envoi).
3. Activez **Use SMTP mail server** et remplissez serveur, port, identifiant, mot de passe. Pour un compte **Gmail**, utilisez `smtp.gmail.com`, port `465` (TLS) et un **mot de passe d'application** (pas le mot de passe normal du compte).
4. Cliquez **Send test email** à votre adresse : vous devez recevoir le message.

> Utilisez de préférence une adresse d'envoi dédiée (ex. un compte « atelier »), pas votre adresse personnelle.

## Étape 7 — Exposer l'instance avec Cloudflare (adresse HTTPS)

Votre tunnel est géré par jeton : le nom public se déclare dans Cloudflare, pas sur le Pi.

1. Ouvrez **Cloudflare → Zero Trust → Networks → Tunnels** et cliquez sur votre tunnel existant (celui de `ssh.gmpbordeaux.fr`) → **Edit** (ou « Configure »).
2. Onglet **Public Hostname** → **Add a public hostname** :
   - Subdomain : `api_colis`
   - Domain : `gmpbordeaux.fr`
   - Service : type **HTTP**, URL `localhost:8093`
3. Enregistrez.

Test depuis n'importe quel navigateur : ouvrez `https://api_colis.gmpbordeaux.fr/api/health` → le message « API is healthy » doit s'afficher.

## Étape 8 — Créer le compte administrateur de l'appli

1. Ouvrez `https://api_colis.gmpbordeaux.fr/_/` et connectez-vous avec le super-utilisateur (étape 4).
2. Menu **Collections** → **colis_admins** → **New record**.
3. Renseignez une **adresse e-mail**, un **mot de passe solide** (8 caractères minimum, et choisissez-en un difficile à deviner : ce compte voit toutes les adresses e-mail) et confirmez. Enregistrez.

C'est ce compte (et non celui du portail) qui sert à se connecter sur `admin.html`.

## Étape 9 — Relier l'appli à PocketBase

Sur votre PC, dans `reception-colis\config.js`, remplacez :

```js
window.PB_URL = "";
```

par :

```js
window.PB_URL = "https://api_colis.gmpbordeaux.fr";
```

Faites ensuite le commit et la publication (dites-le-moi et je m'en occupe, avec le numéro de version à choisir ensemble).
Activez **GitHub Pages** : dépôt `gmp-receptioncommande` → *Settings → Pages* → Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
L'appli sera alors sur `https://gmpbordeaux.fr/gmp-receptioncommande/`.

## Étape 10 — Test complet (5 minutes)

1. `…/commande.html` : déclarez une commande avec **votre** adresse e-mail.
2. `…/reception.html` : retrouvez la tuile, sélectionnez-la, validez (lieu obligatoire) → un QR code apparaît.
3. Scannez le QR code avec un téléphone, prenez une photo, validez.
4. Vous devez recevoir un mail « Votre commande est arrivée » **avec la photo**.
5. `…/admin.html` : connectez-vous, vérifiez la ligne (statut du mail « Envoyé »), l'export Excel, puis la liste des fournisseurs.

Si le mail n'arrive pas : l'admin affiche « Échec » au survol du statut du mail ; vérifiez le SMTP (étape 6) et `journalctl -u pocketbase-colis -n 50`.
**Si la photo n'apparaît pas dans le mail alors que le mail arrive**, prévenez-moi : c'est la seule partie du serveur que je n'ai pas pu essayer (`pb/pb_hooks/colis-lib.js`).

## Aide-mémoire

**Sans service système** (cas du `crontab` @reboot) : pour redémarrer PocketBase à la main, `pkill -f "pocketbase serve --http=127.0.0.1:8093"` puis `cd ~/pocketbase-colis && nohup ./pocketbase serve --http=127.0.0.1:8093 >> logs/pb.log 2>&1 &`.

| Action | Commande (sur le Pi) |
|---|---|
| Voir l'état | `sudo systemctl status pocketbase-colis` |
| Redémarrer (après avoir modifié un fichier du dossier `pb_hooks`) | `sudo systemctl restart pocketbase-colis` |
| Voir les messages d'erreur | `journalctl -u pocketbase-colis -n 50` |
| Sauvegarder les données | copier le dossier `~/pocketbase-colis/pb_data` |

Recommandation : activez la limitation de débit dans *Settings → Application → Rate limiting* du tableau de bord, puisque les pages de commande et de réception sont ouvertes sans mot de passe.
