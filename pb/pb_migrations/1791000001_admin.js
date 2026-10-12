/// <reference path="../pb_data/types.d.ts" />
// Espace administration :
// - comptes "colis_admins" (distincts du super-utilisateur PocketBase)
// - eux seuls peuvent lire / supprimer les fiches "colis" (adresses e-mail comprises)
// - collection "colis_config" (fiche key = "main") : liste des fournisseurs courants
migrate((app) => {
  const isAdmin = '@request.auth.collectionName = "colis_admins"';

  app.save(new Collection({
    type: "auth",
    name: "colis_admins",
    listRule: isAdmin,
    viewRule: isAdmin,
    createRule: isAdmin,
    updateRule: "id = @request.auth.id",
    deleteRule: isAdmin + " && id != @request.auth.id",
    passwordAuth: { enabled: true, identityFields: ["email"] },
  }));

  const colis = app.findCollectionByNameOrId("colis");
  colis.listRule = isAdmin;
  colis.viewRule = isAdmin;
  colis.deleteRule = isAdmin;
  app.save(colis);

  const cfg = new Collection({
    type: "base",
    name: "colis_config",
    listRule: isAdmin, viewRule: isAdmin, createRule: isAdmin, updateRule: isAdmin, deleteRule: null,
    fields: [
      { type: "text", name: "key", required: true },
      { type: "json", name: "data", maxSize: 100000 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_colis_config_key ON colis_config (key)"],
  });
  app.save(cfg);

  const rec = new Record(cfg);
  rec.set("key", "main");
  rec.set("data", { fournisseurs: ["Amazon", "RS", "Mouser", "Farnell", "Distrelec", "Misumi", "Leroy Merlin", "Würth"] });
  app.save(rec);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("colis_config"));
  const colis = app.findCollectionByNameOrId("colis");
  colis.listRule = null; colis.viewRule = null; colis.deleteRule = null;
  app.save(colis);
  app.delete(app.findCollectionByNameOrId("colis_admins"));
});
