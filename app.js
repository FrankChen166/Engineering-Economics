const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const app = express();

const User = require("./models/user");

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "notgood" }));

mongoose
  .connect("mongodb://localhost:27017/EE")
  .then(() => {
    console.log("connecting to mongodb");
  })
  .catch((e) => {
    console.log(e);
  });

app.get("/", (req, res) => {
  res.send("this is a home page");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, studentId, useraccount, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const user = new User({
    username,
    studentId,
    useraccount,
    password: hash,
  });
  await user.save();
  req.session.user_id = user.id;
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  const vaildPassword = await bcrypt.compare(password, user.password);
  if (vaildPassword) {
    req.session.user_id = user._id;
    req.session.username = user.username;
    res.redirect("/home");
  } else {
    res.redirect("/login");
  }
});

app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/login");
});

app.get("/home", (req, res) => {
  const { username } = req.session;
  if (!req.session.user_id) {
    return res.redirect("/login");
  }
  console.log({ username });
  res.render("home", { username });
});

app.get("/ex", (req, res) => {
  res.render("ex");
});

app.listen(3000, () => {
  console.log("sever success");
});
