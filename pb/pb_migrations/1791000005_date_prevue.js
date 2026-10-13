/// <reference path="../pb_data/types.d.ts" />
// Date de réception prévue, indiquée par le commandeur (texte AAAA-MM-JJ, facultatif).
migrate((app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.fields.add(new TextField({ name: "date_prevue" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.fields.removeByName("date_prevue");
  app.save(c);
});
