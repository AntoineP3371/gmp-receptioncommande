// Fonctions communes aux routes /colis/* (ce fichier n'est PAS un hook : il est chargé par require()).
const JOURS_HISTORIQUE = 7;   // les colis réceptionnés restent visibles ce nombre de jours côté opérateurs
const JOURS_PURGE = 90;       // puis sont supprimés au bout de ce nombre de jours
const JOURS_PHOTO = 30;       // les photos (fichiers) sont supprimées au bout de ce nombre de jours, la fiche reste
const DELAI_PHOTO_MIN = 10;   // sans photo après ce délai (minutes), le mail part quand même

function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function validEmail(s) { return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(s); }
function daysAgoIso(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// Nom du fichier photo : champ photo_nom, ou (réceptions d'avant la v0.4) nom lu sur la fiche qui porte la photo
function photoNom(r) {
  const n = r.getString("photo_nom"), rec = r.getString("photo_rec");
  if (n || !rec) return n;
  try { return $app.findRecordById("colis", rec).getString("photo"); } catch (e) { return ""; }
}

// Version publique d'une fiche : SANS l'adresse e-mail ni le code du lot
function pub(r) {
  return {
    id: r.id, prenom: r.getString("prenom"), nom: r.getString("nom"),
    fournisseur: r.getString("fournisseur"), contenu: r.getString("contenu"), reference: r.getString("reference"),
    statut: r.getString("statut"),
    created: r.getString("created"), recu_le: r.getString("recu_le"), operateur: r.getString("operateur"),
    etat: r.getString("etat"), nb_recus: r.getInt("nb_recus"), abime: r.getBool("abime"),
    lieu: r.getString("lieu"), commentaire: r.getString("commentaire"),
    photo_rec: r.getString("photo_rec"), photo_nom: photoNom(r),
  };
}

// Date et heure de Paris au format jj/mm/aaaa à hh:mm (calculées à la main : le moteur JS du serveur n'a pas les réglages régionaux)
function parisDate(iso) {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return "";
  const y = t.getUTCFullYear();
  const lastSunday = (m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
  const debutEte = Date.UTC(y, 2, lastSunday(2), 1);    // dernier dimanche de mars, 01:00 UTC
  const finEte = Date.UTC(y, 9, lastSunday(9), 1);      // dernier dimanche d'octobre, 01:00 UTC
  const decalage = t.getTime() >= debutEte && t.getTime() < finEte ? 2 : 1;
  const p = new Date(t.getTime() + decalage * 3600000);
  const z = (n) => (n < 10 ? "0" : "") + n;
  return z(p.getUTCDate()) + "/" + z(p.getUTCMonth() + 1) + "/" + p.getUTCFullYear() + " à " + z(p.getUTCHours()) + ":" + z(p.getUTCMinutes());
}

// Configuration (fournisseurs, logos…) : fiche "main" de la collection colis_config
function readConfig() {
  try { return JSON.parse($app.findFirstRecordByData("colis_config", "key", "main").getString("data")) || {}; } catch (e) { return {}; }
}
function normKey(s) {
  let t = String(s == null ? "" : s);
  try { t = t.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* pas de normalisation disponible */ }
  return t.trim().toLowerCase();
}
// Nom exact (dans la configuration) du fournisseur s'il a un logo enregistré, sinon ""
function logoKey(fournisseur) {
  const st = readConfig().styles || {};
  const k = normKey(fournisseur);
  const found = Object.keys(st).filter((n) => normKey(n) === k && st[n] && typeof st[n].l === "string" && st[n].l.length > 0);
  return found.length ? found[0] : "";
}
// Décodage base64 → tableau d'octets (le moteur JS n'a pas atob)
function b64decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = [];
  let buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = A.indexOf(s.charAt(i));
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); buf = buf & ((1 << bits) - 1); }
  }
  return out;
}

// Corps du mail. Aucun emoji hors plan de base (📦 📍 💬…) : certains logiciels de messagerie les affichent en carrés vides.
function mailHtml(r, hasPhoto, base) {
  const got = r.getInt("nb_recus");
  const complete = r.getString("etat") === "complete";
  const lignes = [];
  lignes.push(complete ? "✅ <b>Commande complète</b>" : "⚠️ <b>Commande incomplète</b> : il manque des éléments");
  lignes.push("Colis reçus : <b>" + got + "</b>");
  if (r.getBool("abime")) lignes.push("⚠️ <b>Colis abîmé</b> à l'arrivée");
  lignes.push("À récupérer : <b>" + esc(r.getString("lieu")) + "</b>");
  if (r.getString("commentaire")) lignes.push("Remarque : " + esc(r.getString("commentaire")));

  // fournisseur en gras, avec son logo s'il en a un (image servie par la route /colis/logo)
  const f = r.getString("fournisseur");
  const lk = base ? logoKey(f) : "";
  const four = (lk ? '<img src="' + base + "/colis/logo?n=" + encodeURIComponent(lk) + '" alt="" height="30" style="height:30px;vertical-align:middle;margin-right:8px;border-radius:4px"> ' : "") + "<b>" + esc(f) + "</b>";
  const rappel = four + [r.getString("contenu"), r.getString("reference") ? "(" + r.getString("reference") + ")" : ""].filter((x) => x).map((x) => " — " + esc(x)).join("");

  const op = r.getString("operateur");
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;color:#3b3330">' +
    '<div style="background:#169fdb;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Votre commande est arrivée</div>' +
    '<div style="border:1px solid #d5e1e9;border-top:0;border-radius:0 0 10px 10px;padding:18px;line-height:1.7">' +
    "<p>Bonjour " + esc(r.getString("prenom")) + ",</p>" +
    "<p>Votre commande a été réceptionnée à l'atelier :<br>" + rappel + "</p>" +
    "<p>" + lignes.join("<br>") + "</p>" +
    (hasPhoto ? '<p><img src="cid:photo.jpg" alt="Photo de la réception" style="max-width:100%;border-radius:8px;border:1px solid #d5e1e9"></p>' : "") +
    '<p style="color:#6b7f8b;font-size:13px">Réceptionnée' + (op ? " par " + esc(op) : "") + " le " + parisDate(r.getString("recu_le")) +
    "<br>Génie mécanique et productique — IUT de Bordeaux</p></div></div>";
}

// Envoie le mail d'arrivée ; joint la photo du lot si elle existe. Lève une erreur si l'envoi échoue.
function sendMail(r) {
  const s = $app.settings();
  let fsys, reader;
  try {
    const opts = {
      from: { address: s.meta.senderAddress, name: "Réception colis GMP" },
      to: [{ address: r.getString("email") }],
      subject: "Votre commande est arrivée" + (r.getString("fournisseur") ? " (" + r.getString("fournisseur") + ")" : ""),
    };
    const holderId = r.getString("photo_rec");
    if (holderId) {
      const h = $app.findRecordById("colis", holderId);
      if (h.getString("photo")) {
        fsys = $app.newFilesystem();
        reader = fsys.getReader(h.baseFilesPath() + "/" + h.getString("photo"));
        opts.inlineAttachments = { "photo.jpg": reader };
      }
    }
    const base = String(s.meta.appURL || "").replace(/\/+$/, "");     // « Application URL » réglée dans PocketBase
    opts.html = mailHtml(r, !!opts.inlineAttachments, base);
    $app.newMailClient().send(new MailerMessage(opts));
  } finally {
    if (reader) reader.close();
    if (fsys) fsys.close();
  }
}

// Envoie le mail d'une fiche et la marque comme traitée (en cas d'échec, l'erreur est conservée, pas de nouvel essai)
function dispatch(r) {
  let err = "";
  try { sendMail(r); } catch (e) { err = String(e); console.log("colis: envoi mail impossible : " + err); }
  r.set("mail_envoye", true);
  r.set("mail_erreur", err);
  $app.save(r);
  return err;
}

// Fiches réceptionnées d'un même lot (le code du lot est le secret du QR code)
function lotRecords(lot) {
  if (!lot || lot.length < 16) return [];
  return $app.findRecordsByFilter("colis", "lot = {:l} && statut = 'recu'", "created", 50, 0, { l: lot });
}

module.exports = { JOURS_HISTORIQUE, JOURS_PURGE, JOURS_PHOTO, DELAI_PHOTO_MIN, clean, esc, validEmail, daysAgoIso, pub, sendMail, dispatch, lotRecords, readConfig, normKey, logoKey, b64decode, parisDate };
