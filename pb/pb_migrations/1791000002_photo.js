/// <reference path="../pb_data/types.d.ts" />
// Photos de réception : miniatures légères (liste des commandes), plafond de taille,
// et champ "photo_nom" (nom du fichier, pour construire l'adresse de la photo).
migrate((app) => {
  const c = app.findCollectionByNameOrId("colis");
  const photo = c.fields.getByName("photo");
  photo.thumbs = ["480x0"];
  photo.maxSize = 3000000;   // 3 Mo : l'appli envoie des JPEG réduits (~200 Ko)
  c.fields.add(new TextField({ name: "photo_nom" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("colis");
  c.fields.removeByName("photo_nom");
  const photo = c.fields.getByName("photo");
  photo.thumbs = [];
  photo.maxSize = 8000000;
  app.save(c);
});
