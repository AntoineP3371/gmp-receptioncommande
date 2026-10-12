// Couche commune : accès aux données (PocketBase ou mode démo) + petits outils
(function () {
  const PB = (window.PB_URL || "").replace(/\/$/, "");
  const demo = !PB;

  // ---------- Outils ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } };
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const nomComplet = (r) => (r.nom || "").toUpperCase() + " " + (r.prenom || "");

  function toast(msg, kind) {
    let box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  }

  // ---------- Mode démo (navigateur seulement) ----------
  const DEMO_KEY = "rc_demo";
  function demoLoad() {
    let l = lsGet(DEMO_KEY, null);
    if (!l) {
      const now = Date.now();
      const mk = (i, prenom, nom, email, fournisseur, contenu, reference) => ({
        id: "d" + i, prenom, nom, email, fournisseur, contenu, reference, statut: "attendu",
        created: new Date(now - i * 3600e3 * 5).toISOString(), recu_le: "", operateur: "", etat: "", nb_recus: 0, abime: false, lieu: "", commentaire: "",
      });
      l = [
        mk(1, "Camille", "Martin", "camille.martin@example.com", "RS", "Roulements 6204 + vis M6", "CMD-1042"),
        mk(2, "Lucas", "Bernard", "lucas.bernard@example.com", "Amazon", "Câbles et connecteurs", ""),
        mk(3, "Inès", "Dubois", "ines.dubois@example.com", "Mouser", "Cartes Arduino", "SAE-12"),
        mk(4, "Hugo", "Moreau", "hugo.moreau@example.com", "Misumi", "Guidages linéaires", "MIS-778"),
        mk(5, "Léa", "Petit", "lea.petit@example.com", "Farnell", "Capteurs", ""),
        mk(6, "Antoine", "Durand", "antoine.durand@example.com", "Amazon", "Outils de mesure", ""),
      ];
      lsSet(DEMO_KEY, l);
    }
    return l;
  }
  const demoSave = (l) => lsSet(DEMO_KEY, l);
  const pubOf = (r) => { const o = Object.assign({}, r); delete o.email; return o; };

  function demoMailText(r) {
    const c = r.etat === "complete";
    return "À : " + r.email + "\nObjet : 📦 Votre commande est arrivée (" + r.fournisseur + ")\n\n" +
      "Bonjour " + r.prenom + ",\n" +
      (c ? "✅ Commande complète" : "⚠️ Commande incomplète") + "\n📦 " + r.nb_recus + " colis reçu" + (r.nb_recus > 1 ? "s" : "") + "\n" +
      (r.abime ? "⚠️ Colis abîmé\n" : "") + (r.photo ? "📷 [photo de la réception jointe]\n" : "") + "📍 À récupérer : " + r.lieu + "\n" + (r.commentaire ? "💬 " + r.commentaire + "\n" : "");
  }

  const demoApi = {
    async list() { return { items: demoLoad().map(pubOf).sort((a, b) => b.created.localeCompare(a.created)) }; },
    async declare(b) {
      const l = demoLoad();
      const r = { id: "d" + Date.now(), prenom: b.prenom, nom: b.nom, email: String(b.email).toLowerCase(), fournisseur: b.fournisseur, contenu: b.contenu || "", reference: b.reference || "", statut: "attendu", created: new Date().toISOString(), recu_le: "", operateur: "", etat: "", nb_recus: 0, abime: false, lieu: "", commentaire: "" };
      l.push(r); demoSave(l);
      return { item: pubOf(r) };
    },
    async receive(b) {
      const l = demoLoad(), results = [], lot = "demo" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      for (const it of b.items) {
        const r = l.find((x) => x.id === it.id);
        if (!r) { results.push({ id: it.id, error: "Introuvable" }); continue; }
        if (r.statut === "recu") { results.push({ id: r.id, error: "Déjà réceptionné" }); continue; }
        Object.assign(r, { statut: "recu", recu_le: new Date().toISOString(), etat: b.etat, nb_recus: Math.max(1, Math.min(99, parseInt(it.nb_recus, 10) || 1)), abime: !!b.abime, lieu: b.lieu, commentaire: b.commentaire || "", operateur: b.operateur || "", lot, mail_envoye: false, photo: false });
        results.push({ id: r.id });
      }
      demoSave(l);
      return { lot, results };
    },
    async lot(lot) {
      const rows = demoLoad().filter((r) => r.lot === lot);
      if (!rows.length) throw new Error("Lot introuvable.");
      const sent = rows.every((r) => r.mail_envoye);
      return { items: rows.map((r) => ({ prenom: r.prenom, nom: r.nom, fournisseur: r.fournisseur })), sent, photo: rows.some((r) => r.photo), erreur: "", demoMails: sent ? rows.map(demoMailText) : [] };
    },
    async sendNow(lot) {
      const l = demoLoad(); l.filter((r) => r.lot === lot).forEach((r) => { r.mail_envoye = true; }); demoSave(l); return { sent: true, erreur: "" };
    },
    async photo(lot, blob) {
      const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const l = demoLoad(), rows = l.filter((r) => r.lot === lot);
      if (!rows.length) throw new Error("Lot introuvable.");
      if (rows.every((r) => r.mail_envoye)) throw new Error("Les mails de ce lot sont déjà partis.");
      rows.forEach((r) => { r.photo = true; r.photo_data = dataUrl; r.mail_envoye = true; }); demoSave(l); return { sent: true, erreur: "" };
    },
    async config() { const c = lsGet("rc_demo_config", {}); return { fournisseurs: c.fournisseurs || window.FOURNISSEURS || [], operateurs: c.operateurs || [] }; },
    async mine(b) { const e = String(b.email).toLowerCase(); return { items: demoLoad().filter((r) => r.email === e).map(pubOf) }; },
    async cancel(b) {
      const l = demoLoad(), r = l.find((x) => x.id === b.id);
      if (!r || r.email !== String(b.email).toLowerCase() || r.statut !== "attendu") throw new Error("Impossible d'annuler.");
      demoSave(l.filter((x) => x !== r)); return { ok: true };
    },
  };

  // ---------- Mode PocketBase ----------
  async function call(path, body) {
    const r = await fetch(PB + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "Erreur " + r.status);
    return j;
  }
  const pbApi = {
    list: () => call("/colis/list"),
    declare: (b) => call("/colis/declare", b),
    receive: (b) => call("/colis/receive", b),
    mine: (b) => call("/colis/mine", b),
    cancel: (b) => call("/colis/cancel", b),
    config: () => call("/colis/config"),
    lot: (lot) => call("/colis/lot?lot=" + encodeURIComponent(lot)),
    sendNow: (lot) => call("/colis/send-now", { lot }),
    async photo(lot, blob) {
      const fd = new FormData(); fd.append("lot", lot); fd.append("photo", blob, "photo.jpg");
      const r = await fetch(PB + "/colis/photo", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "Erreur " + r.status);
      return j;
    },
  };

  function themeBanner() {
    if (!demo) return;
    const d = document.createElement("div");
    d.className = "demo-banner";
    d.textContent = "MODE DÉMO — données enregistrées dans ce navigateur, aucun e-mail n'est envoyé";
    document.body.prepend(d);
  }
  document.addEventListener("DOMContentLoaded", themeBanner);

  // Accès « admin » du mode démo (en mode PocketBase, admin.html parle directement à l'API protégée)
  const demoAdmin = {
    all: () => demoLoad(),
    remove: (id) => demoSave(demoLoad().filter((r) => r.id !== id)),
    setConfig: (cfg) => lsSet("rc_demo_config", cfg),
  };

  // Adresse de la photo d'une commande réceptionnée (miniature légère si thumb = true), ou "" s'il n'y en a pas
  function photoUrl(r, thumb) {
    if (demo) return r.photo_data || "";
    if (!r.photo_rec || !r.photo_nom) return "";
    return PB + "/api/files/colis/" + r.photo_rec + "/" + encodeURIComponent(r.photo_nom) + (thumb ? "?thumb=480x0" : "");
  }

  window.RC = { api: demo ? demoApi : pbApi, demo, demoAdmin, PB, photoUrl, esc, lsGet, lsSet, fmtDate, nomComplet, toast };
})();
