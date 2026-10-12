// Clavier AZERTY à l'écran pour l'interface tactile de réception (aucune dépendance).
// S'ouvre quand une zone de texte est touchée ; actif par défaut sur un écran tactile,
// activable / désactivable avec le bouton ⌨ (choix mémorisé), ou avec ?clavier=1 / ?clavier=0 dans l'adresse.
(function () {
  const ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "{bksp}"],
    ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
    ["{shift}", "w", "x", "c", "v", "b", "n", "'", "-", "."],
    ["é", "è", "ê", "à", "ù", "ç", "ï", "ô", "î", "â"],
    ["_", "@", "/", "{space}", ",", "{ok}"],
  ];
  const LABEL = { "{bksp}": "⌫", "{shift}": "⇧", "{space}": "espace", "{ok}": "OK ✓" };

  let enabled = false, kb = null, current = null, shift = true, hideTimer = null, toggleBtn = null;

  const isText = (el) => el && ((el.tagName === "INPUT" && /^(text|search|email|tel|url)?$/.test(el.type || "")) || el.tagName === "TEXTAREA");
  const get = () => { try { return localStorage.getItem("rc_clavier"); } catch (e) { return null; } };
  const set = (v) => { try { localStorage.setItem("rc_clavier", v); } catch (e) { /* */ } };

  function build() {
    kb = document.createElement("div");
    kb.id = "kb"; kb.hidden = true;
    kb.innerHTML = ROWS.map((row) => '<div class="kbrow">' + row.map((k) => {
      const cls = "kbkey" + (k === "{space}" ? " space" : "") + (k === "{ok}" ? " ok" : "") + (k === "{shift}" ? " shift" : "") + (k === "{bksp}" ? " bksp" : "");
      return `<button type="button" class="${cls}" data-k="${k.replace(/"/g, "&quot;")}">${LABEL[k] || k}</button>`;
    }).join("") + "</div>").join("");
    document.body.appendChild(kb);
    // mousedown/pointerdown ne doivent pas faire perdre le focus à la zone de texte
    kb.addEventListener("mousedown", (e) => e.preventDefault());
    kb.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") e.preventDefault(); });
    kb.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); });
  }

  function autoShift() {
    // majuscule au début de la zone, ou après un espace / tiret / apostrophe
    const v = current ? current.value : "";
    const pos = current && current.selectionStart != null ? current.selectionStart : v.length;
    const prev = v.slice(0, pos).slice(-1);
    shift = pos === 0 || prev === " " || prev === "-" || prev === "'";
    paintShift();
  }
  function paintShift() {
    if (!kb) return;
    kb.classList.toggle("up", shift);
    kb.querySelectorAll(".kbkey").forEach((b) => {
      const k = b.dataset.k;
      if (k.length === 1 && /\p{L}/u.test(k)) b.textContent = shift ? k.toUpperCase() : k.toLowerCase();
    });
    const s = kb.querySelector(".shift"); if (s) s.classList.toggle("on", shift);
  }

  function fire(el) { el.dispatchEvent(new Event("input", { bubbles: true })); }

  function press(k) {
    const el = current;
    if (!el) return;
    if (k === "{ok}") { el.blur(); hide(); return; }
    if (k === "{shift}") { shift = !shift; paintShift(); return; }
    const s = el.selectionStart == null ? el.value.length : el.selectionStart, e = el.selectionEnd == null ? s : el.selectionEnd;
    if (k === "{bksp}") {
      if (s !== e) el.setRangeText("", s, e, "end");
      else if (s > 0) el.setRangeText("", s - 1, s, "end");
    } else {
      let ch = k === "{space}" ? " " : k;
      if (/\p{L}/u.test(ch)) ch = shift ? ch.toUpperCase() : ch.toLowerCase();
      el.setRangeText(ch, s, e, "end");
    }
    fire(el);
    autoShift();
  }

  function show() {
    if (!enabled || !kb) return;
    clearTimeout(hideTimer);
    kb.hidden = false;
    document.body.classList.add("kb-open");
    document.documentElement.style.setProperty("--kbh", kb.offsetHeight + "px");
    if (current) setTimeout(() => current && current.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  }
  function hide() {
    if (!kb) return;
    kb.hidden = true;
    document.body.classList.remove("kb-open");
    document.documentElement.style.setProperty("--kbh", "0px");
  }

  function paintToggle() {
    if (!toggleBtn) return;
    toggleBtn.classList.toggle("on", enabled);
    toggleBtn.title = enabled ? "Clavier à l'écran activé (toucher pour désactiver)" : "Clavier à l'écran désactivé (toucher pour activer)";
  }

  function setEnabled(v) {
    enabled = v; set(v ? "1" : "0");
    if (!v) { hide(); document.querySelectorAll('[data-kb-managed]').forEach((el) => { el.removeAttribute("inputmode"); el.removeAttribute("data-kb-managed"); }); }
    paintToggle();
  }

  function init(opts) {
    opts = opts || {};
    const q = new URLSearchParams(location.search).get("clavier");
    const stored = get();
    enabled = q === "1" ? true : q === "0" ? false : stored != null ? stored === "1" : (navigator.maxTouchPoints || 0) > 0;
    toggleBtn = opts.toggle || null;
    build();
    if (toggleBtn) { toggleBtn.addEventListener("click", () => { setEnabled(!enabled); if (enabled && isText(document.activeElement)) { current = document.activeElement; autoShift(); show(); } }); paintToggle(); }

    document.addEventListener("focusin", (e) => {
      if (!isText(e.target) || (kb && kb.contains(e.target))) return;
      current = e.target;
      if (enabled) {
        e.target.setAttribute("inputmode", "none");        // pas de second clavier système
        e.target.setAttribute("data-kb-managed", "1");
        autoShift(); show();
      }
    });
    document.addEventListener("focusout", () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!isText(document.activeElement)) hide(); }, 200);
    });
    // le clavier suit une zone de texte recréée (ex. fenêtre de validation redessinée)
    window.addEventListener("resize", () => { if (kb && !kb.hidden) document.documentElement.style.setProperty("--kbh", kb.offsetHeight + "px"); });
  }

  window.Clavier = { init };
})();
