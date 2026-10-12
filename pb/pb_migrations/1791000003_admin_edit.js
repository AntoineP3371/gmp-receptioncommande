/// <reference path="../pb_data/types.d.ts" />
// Les administrateurs peuvent modifier ou annuler une réception (mise à jour d'une fiche "colis").
migrate((app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.updateRule = '@request.auth.collectionName = "colis_admins"';
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.updateRule = null;
  app.save(c);
});
