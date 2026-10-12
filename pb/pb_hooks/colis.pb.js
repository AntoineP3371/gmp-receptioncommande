/// <reference path="../pb_data/types.d.ts" />
// Routes publiques de l'appli « Réception colis ».
// Les adresses e-mail ne sortent jamais du serveur (sauf pour la personne qui retrouve SES colis).

// GET /colis/list : colis attendus + réceptionnés récemment (sans e-mail)
routerAdd("GET", "/colis/list", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const rows = $app.findRecordsByFilter("colis", "statut = 'attendu' || recu_le >= {:d}", "-created", 500, 0, { d: L.daysAgoIso(L.JOURS_HISTORIQUE) });
  return e.json(200, { items: rows.map(L.pub) });
});

// GET /colis/config : fournisseurs courants et liste des opérateurs (modifiables dans l'espace admin)
routerAdd("GET", "/colis/config", (e) => {
  let fournisseurs = [], operateurs = [], lieux = [], styles = {}, emojis = {};
  try {
    const cfg = JSON.parse($app.findFirstRecordByData("colis_config", "key", "main").getString("data"));
    if (Array.isArray(cfg.fournisseurs)) fournisseurs = cfg.fournisseurs.slice(0, 100).map((f) => String(f).slice(0, 80));
    if (Array.isArray(cfg.operateurs)) operateurs = cfg.operateurs.slice(0, 100).map((f) => String(f).slice(0, 60));
    // couleur (#rrggbb) et logo (petite image en data-URL) de chaque fournisseur : on ne renvoie que des valeurs valides
    if (Array.isArray(cfg.lieux)) lieux = cfg.lieux.slice(0, 40).map((f) => String(f).slice(0, 80));
    // émoticone de chaque opérateur : renvoyé sous forme "u:1F4E6-FE0F" (codes hexadécimaux), décodé par la page
    const em = cfg.emojis || {};
    Object.keys(em).slice(0, 100).forEach((k) => {
      const v = em[k];
      if (typeof v === "string" && v.length > 0 && v.length <= 16) {
        const cps = [];
        for (const ch of v) cps.push(ch.codePointAt(0).toString(16).toUpperCase());
        emojis[String(k).slice(0, 60)] = "u:" + cps.join("-");
      }
    });
    const st = cfg.styles || {};
    Object.keys(st).slice(0, 100).forEach((k) => {
      const v = st[k] || {}, out = {};
      if (typeof v.c === "string" && /^#[0-9a-fA-F]{6}$/.test(v.c)) out.c = v.c;
      if (typeof v.l === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(v.l) && v.l.length <= 80000) out.l = v.l;
      if (out.c || out.l) styles[String(k).slice(0, 80)] = out;
    });
  } catch (err) { /* pas encore de configuration */ }
  return e.json(200, { fournisseurs: fournisseurs, operateurs: operateurs, lieux: lieux, styles: styles, emojis: emojis });
});

// GET /colis/logo?n=Fournisseur : image du logo d'un fournisseur (affichée dans les mails)
routerAdd("GET", "/colis/logo", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const name = L.clean(e.request.url.query().get("n"), 80);
  const key = L.logoKey(name);
  if (!key) return e.json(404, { message: "Pas de logo." });
  const m = String(L.readConfig().styles[key].l).match(/^data:image.(png|jpeg|webp);base64,(.+)$/);
  if (!m) return e.json(404, { message: "Logo illisible." });
  e.response.header().set("Cache-Control", "public, max-age=3600");
  return e.blob(200, "image/" + m[1], L.b64decode(m[2]));
});

// POST /colis/declare : le commandeur déclare une commande attendue
routerAdd("POST", "/colis/declare", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const b = e.requestInfo().body || {};
  const prenom = L.clean(b.prenom, 60), nom = L.clean(b.nom, 60), email = L.clean(b.email, 120).toLowerCase();
  const fournisseur = L.clean(b.fournisseur, 80);
  if (!prenom || !nom) return e.json(400, { message: "Prénom et nom obligatoires." });
  if (!L.validEmail(email)) return e.json(400, { message: "Adresse e-mail invalide." });
  if (!fournisseur) return e.json(400, { message: "Fournisseur obligatoire." });
  const rec = new Record($app.findCollectionByNameOrId("colis"));
  rec.set("prenom", prenom);
  rec.set("nom", nom);
  rec.set("email", email);
  rec.set("fournisseur", fournisseur);
  rec.set("contenu", L.clean(b.contenu, 200));
  rec.set("reference", L.clean(b.reference, 80));
  rec.set("statut", "attendu");
  $app.save(rec);
  return e.json(200, { item: L.pub(rec) });
});

// POST /colis/receive : l'opérateur valide la réception d'un ou plusieurs colis.
// Les mails NE partent PAS encore : ils attendent la photo (QR code) ou « envoyer sans photo ».
// { items:[{id, nb_recus}], etat:"complete"|"incomplete", abime:bool, lieu, commentaire, operateur }
routerAdd("POST", "/colis/receive", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const b = e.requestInfo().body || {};
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  const lieu = L.clean(b.lieu, 80);
  if (!items.length) return e.json(400, { message: "Aucun colis sélectionné." });
  if (!lieu) return e.json(400, { message: "Choisissez un lieu de mise à disposition." });
  const etat = b.etat === "incomplete" ? "incomplete" : "complete";
  const lot = $security.randomString(24);

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    let rec;
    try { rec = $app.findRecordById("colis", String(it.id)); } catch (err) { results.push({ id: it.id, error: "Introuvable" }); continue; }
    if (rec.getString("statut") === "recu") { results.push({ id: rec.id, error: "Déjà réceptionné" }); continue; }
    rec.set("statut", "recu");
    rec.set("recu_le", new Date().toISOString());
    rec.set("etat", etat);
    rec.set("nb_recus", Math.max(1, Math.min(99, parseInt(it.nb_recus, 10) || 1)));
    rec.set("abime", !!b.abime);
    rec.set("lieu", lieu);
    rec.set("commentaire", L.clean(b.commentaire, 300));
    rec.set("operateur", L.clean(b.operateur, 60));
    rec.set("lot", lot);
    rec.set("mail_envoye", false);
    $app.save(rec);
    results.push({ id: rec.id });
  }
  return e.json(200, { lot: lot, results: results });
});

// GET /colis/lot?lot=... : état d'un lot (page photo du téléphone + suivi sur le PC de l'opérateur)
routerAdd("GET", "/colis/lot", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const rows = L.lotRecords(L.clean(e.request.url.query().get("lot"), 60));
  if (!rows.length) return e.json(404, { message: "Lot introuvable." });
  return e.json(200, {
    items: rows.map((r) => ({ prenom: r.getString("prenom"), nom: r.getString("nom"), fournisseur: r.getString("fournisseur") })),
    sent: rows.every((r) => r.getBool("mail_envoye")),
    photo: rows.some((r) => !!r.getString("photo_rec")),
    erreur: rows.map((r) => r.getString("mail_erreur")).filter((x) => x)[0] || "",
  });
});

// POST /colis/send-now { lot } : envoie les mails sans photo
routerAdd("POST", "/colis/send-now", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const rows = L.lotRecords(L.clean((e.requestInfo().body || {}).lot, 60));
  if (!rows.length) return e.json(404, { message: "Lot introuvable." });
  let erreur = "";
  rows.forEach((r) => { if (!r.getBool("mail_envoye")) erreur = L.dispatch(r) || erreur; });
  return e.json(200, { sent: true, erreur: erreur });
});

// POST /colis/photo (multipart : lot + photo) : enregistre la photo et envoie les mails du lot avec la photo
routerAdd("POST", "/colis/photo", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const rows = L.lotRecords(L.clean(e.request.formValue("lot"), 60));
  if (!rows.length) return e.json(404, { message: "Lot introuvable." });
  if (rows.every((r) => r.getBool("mail_envoye"))) return e.json(409, { message: "Les mails de ce lot sont déjà partis." });
  const files = e.findUploadedFiles("photo");
  if (!files || !files.length) return e.json(400, { message: "Aucune photo reçue." });
  const holder = rows[0];
  holder.set("photo", files[0]);
  $app.save(holder);
  rows.forEach((r) => { r.set("photo_rec", holder.id); r.set("photo_nom", holder.getString("photo")); });
  let erreur = "";
  rows.forEach((r) => { if (!r.getBool("mail_envoye")) erreur = L.dispatch(r) || erreur; });
  return e.json(200, { sent: true, erreur: erreur });
});

// POST /colis/mine { email } : le commandeur retrouve ses colis
routerAdd("POST", "/colis/mine", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const email = L.clean((e.requestInfo().body || {}).email, 120).toLowerCase();
  if (!L.validEmail(email)) return e.json(400, { message: "Adresse e-mail invalide." });
  const rows = $app.findRecordsByFilter("colis", "email = {:e} && (statut = 'attendu' || recu_le >= {:d})", "-created", 100, 0, { e: email, d: L.daysAgoIso(30) });
  return e.json(200, { items: rows.map(L.pub) });
});

// POST /colis/cancel { id, email } : annule une commande pas encore réceptionnée
routerAdd("POST", "/colis/cancel", (e) => {
  const L = require(`${__hooks}/colis-lib.js`);
  const b = e.requestInfo().body || {};
  let rec;
  try { rec = $app.findRecordById("colis", String(b.id)); } catch (err) { return e.json(404, { message: "Introuvable." }); }
  if (rec.getString("email") !== L.clean(b.email, 120).toLowerCase()) return e.json(403, { message: "Cette commande n'est pas à cette adresse." });
  if (rec.getString("statut") !== "attendu") return e.json(400, { message: "Déjà réceptionnée." });
  $app.delete(rec);
  return e.json(200, { ok: true });
});

// Toutes les minutes : les mails restés sans photo depuis plus de 10 minutes partent sans photo
cronAdd("colis_mails_en_attente", "* * * * *", () => {
  const L = require(`${__hooks}/colis-lib.js`);
  const rows = $app.findRecordsByFilter("colis", "statut = 'recu' && mail_envoye != true && recu_le < {:d}", "recu_le", 50, 0, { d: new Date(Date.now() - L.DELAI_PHOTO_MIN * 60000).toISOString() });
  rows.forEach((r) => L.dispatch(r));
});

// Nettoyage quotidien (3 h 10) : supprime les FICHIERS photo de plus de 30 jours (les fiches restent)
cronAdd("colis_purge_photos", "10 3 * * *", () => {
  const L = require(`${__hooks}/colis-lib.js`);
  const old = $app.findRecordsByFilter("colis", "photo != '' && recu_le != '' && recu_le < {:d}", "", 500, 0, { d: L.daysAgoIso(L.JOURS_PHOTO) });
  old.forEach((h) => {
    $app.findRecordsByFilter("colis", "photo_rec = {:h}", "", 100, 0, { h: h.id }).forEach((r) => {
      if (r.id !== h.id) { r.set("photo_rec", ""); r.set("photo_nom", ""); $app.save(r); }
    });
    h.set("photo", "");
    h.set("photo_rec", "");
    h.set("photo_nom", "");
    $app.save(h);
  });
});

// Nettoyage quotidien (3 h) : supprime les réceptions de plus de 90 jours
cronAdd("colis_purge", "0 3 * * *", () => {
  const L = require(`${__hooks}/colis-lib.js`);
  const old = $app.findRecordsByFilter("colis", "statut = 'recu' && recu_le < {:d}", "", 500, 0, { d: L.daysAgoIso(L.JOURS_PURGE) });
  for (let i = 0; i < old.length; i++) $app.delete(old[i]);
});
