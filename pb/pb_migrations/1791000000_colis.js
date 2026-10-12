/// <reference path="../pb_data/types.d.ts" />
// Crée la collection "colis" (une fiche par commande attendue).
// Aucune règle d'API publique : tout passe par les routes /colis/* (pb_hooks/colis.pb.js),
// ce qui permet de ne jamais exposer l'adresse e-mail des commandeurs.
migrate((app) => {
  const c = new Collection({
    type: "base",
    name: "colis",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "prenom" },
      { type: "text", name: "nom" },
      { type: "text", name: "email" },
      { type: "text", name: "fournisseur" },
      { type: "text", name: "contenu" },
      { type: "text", name: "reference" },
      { type: "text", name: "statut" },      // "attendu" ou "recu"
      { type: "text", name: "recu_le" },     // date ISO
      { type: "text", name: "operateur" },
      { type: "text", name: "etat" },        // "complete" ou "incomplete"
      { type: "number", name: "nb_recus" },
      { type: "bool", name: "abime" },
      { type: "text", name: "lieu" },
      { type: "text", name: "commentaire" },
      { type: "text", name: "lot" },          // code secret du lot de réception (QR code de la photo)
      { type: "bool", name: "mail_envoye" },
      { type: "text", name: "mail_erreur" },
      { type: "file", name: "photo", maxSelect: 1, maxSize: 8000000, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { type: "text", name: "photo_rec" },   // id de la fiche du lot qui porte le fichier photo
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_colis_statut ON colis (statut)", "CREATE INDEX idx_colis_lot ON colis (lot)"],
  });
  app.save(c);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("colis"));
});
