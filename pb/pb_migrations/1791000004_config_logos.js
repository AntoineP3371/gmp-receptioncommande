/// <reference path="../pb_data/types.d.ts" />
// La configuration (fournisseurs, opérateurs, couleurs et logos des fournisseurs) peut contenir
// de petites images : on relève la taille maximale du champ JSON.
migrate((app) => {
  const c = app.findCollectionByNameOrId("colis_config");
  c.fields.getByName("data").maxSize = 3000000;
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("colis_config");
  c.fields.getByName("data").maxSize = 100000;
  app.save(c);
});
