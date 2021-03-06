const express = require("express");
const fs = require("fs");
const app = express();
const port = 3000;

app.use("/dist", express.static(__dirname + "/dist"));
app.use("/static", express.static(__dirname + "/static"));

app.set("view engine", "ejs");
app.set("views", "./client/pages");

const models = fs
  .readdirSync(__dirname + "/models")
  .map(filename => filename.replace(".ejs", ""));

app.get("*", function(req, res) {
  const { path } = req;
  if (path === "/") {
    res.render("index", { path, models, nav: true });
  }

  if (!fs.existsSync(__dirname + "/models/" + path + ".ejs")) {
    res.status(404).render("404", { nav: true });
  }

  res.render("page", { path, models, nav: false });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
