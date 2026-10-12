// Fonctions communes aux routes /colis/* (ce fichier n'est PAS un hook : il est chargé par require()).
const JOURS_HISTORIQUE = 7;   // les colis réceptionnés restent visibles ce nombre de jours côté opérateurs
const JOURS_PURGE = 90;       // puis sont supprimés au bout de ce nombre de jours
const DELAI_PHOTO_MIN = 10;   // sans photo après ce délai (minutes), le mail part quand même

function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function validEmail(s) { return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(s); }
function daysAgoIso(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// Version publique d'une fiche : SANS l'adresse e-mail ni le code du lot
function pub(r) {
  return {
    id: r.id, prenom: r.getString("prenom"), nom: r.getString("nom"),
    fournisseur: r.getString("fournisseur"), contenu: r.getString("contenu"), reference: r.getString("reference"),
    statut: r.getString("statut"),
    created: r.getString("created"), recu_le: r.getString("recu_le"), operateur: r.getString("operateur"),
    etat: r.getString("etat"), nb_recus: r.getInt("nb_recus"), abime: r.getBool("abime"),
    lieu: r.getString("lieu"), commentaire: r.getString("commentaire"),
    photo: !!r.getString("photo_rec"),
  };
}

function mailHtml(r, hasPhoto) {
  const got = r.getInt("nb_recus");
  const complete = r.getString("etat") === "complete";
  const lignes = [];
  lignes.push(complete ? "✅ <b>Commande complète</b>" : "⚠️ <b>Commande incomplète</b> : il manque des éléments");
  lignes.push("📦 " + got + " colis reçu" + (got > 1 ? "s" : ""));
  if (r.getBool("abime")) lignes.push("⚠️ <b>Colis abîmé</b> à l'arrivée");
  lignes.push("📍 À récupérer : <b>" + esc(r.getString("lieu")) + "</b>");
  if (r.getString("commentaire")) lignes.push("💬 " + esc(r.getString("commentaire")));
  const rappel = [r.getString("fournisseur"), r.getString("contenu"), r.getString("reference")].filter((x) => x).map(esc).join(" — ");
  const op = r.getString("operateur");
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;color:#3b3330">' +
    '<div style="background:#169fdb;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">📦 Votre commande est arrivée</div>' +
    '<div style="border:1px solid #d5e1e9;border-top:0;border-radius:0 0 10px 10px;padding:18px;line-height:1.7">' +
    "<p>Bonjour " + esc(r.getString("prenom")) + ",</p>" +
    "<p>Votre commande a été réceptionnée à l'atelier :<br><i>" + rappel + "</i></p>" +
    "<p>" + lignes.join("<br>") + "</p>" +
    (hasPhoto ? '<p><img src="cid:photo.jpg" alt="Photo de la réception" style="max-width:100%;border-radius:8px;border:1px solid #d5e1e9"></p>' : "") +
    '<p style="color:#6b7f8b;font-size:13px">Réceptionnée' + (op ? " par " + esc(op) : "") + " le " +
    new Date(r.getString("recu_le")).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) +
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
      subject: "📦 Votre commande est arrivée" + (r.getString("fournisseur") ? " (" + r.getString("fournisseur") + ")" : ""),
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
    opts.html = mailHtml(r, !!opts.inlineAttachments);
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

module.exports = { JOURS_HISTORIQUE, JOURS_PURGE, DELAI_PHOTO_MIN, clean, esc, validEmail, daysAgoIso, pub, sendMail, dispatch, lotRecords };
