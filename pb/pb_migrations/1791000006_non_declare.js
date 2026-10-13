/// <reference path="../pb_data/types.d.ts" />
// Colis arrivé sans avoir été déclaré, saisi directement par l'opérateur.
migrate((app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.fields.add(new BoolField({ name: "non_declare" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.fields.removeByName("non_declare");
  app.save(c);
});
