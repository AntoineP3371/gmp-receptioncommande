// Petit serveur de TEST (aucune dépendance) : sert le dossier de l'appli en mode démo.
// Accessible aussi depuis un téléphone du même réseau (pour essayer le QR code).
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = parseInt(process.env.PORT, 10) || 8781;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".md": "text/plain; charset=utf-8" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(__dirname, path.normalize(p));
  if (!file.startsWith(__dirname) || file.includes(path.sep + "pb" + path.sep)) { res.writeHead(403); return res.end("Interdit"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Introuvable"); }
    // En test, on force le mode démo (le vrai config.js pointe vers PocketBase)
    if (path.basename(file) === "config.js") data = Buffer.from(data.toString("utf8").replace(/window.PB_URL = "[^"]*";/, 'window.PB_URL = "";'));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  Reception colis - MODE TEST (donnees dans le navigateur, aucun mail envoye)");
  console.log("");
  console.log("  Sur ce PC          : http://localhost:" + PORT + "/");
  Object.values(os.networkInterfaces()).flat().filter((i) => i.family === "IPv4" && !i.internal)
    .forEach((i) => console.log("  Depuis le reseau   : http://" + i.address + ":" + PORT + "/   (telephone sur le meme wifi)"));
  console.log("");
  console.log("  Pour arreter : fermez cette fenetre (ou Ctrl+C).");
}).on("error", (e) => { console.log("Impossible de demarrer : " + e.message + " (port " + PORT + " deja utilise ?)"); process.exit(1); });
