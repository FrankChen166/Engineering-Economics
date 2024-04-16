const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const app = express();

const User = require("./models/user");
const UserInfo = require("./models/userInfo");

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

const questions = [
  {
    question: "以下哪个是 JavaScript 的一种框架？",
    options: ["A. React", "B. Vue", "C. Angular", "D. Django"],
    answer: "A",
  },
  {
    question: "下面哪个是世界上最高的山峰？",
    options: ["A. 乔戈里峰", "B. 喜马拉雅山", "C. 峨眉山", "D. 摩天峰"],
    answer: "B",
  },
  {
    question: "哪个是最流行的编程语言？",
    options: ["A. Python", "B. Java", "C. C++", "D. Ruby"],
    answer: "A",
  },
];

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
  res.render("ex", { questions });
});

app.post("/ex/submit", async (req, res) => {
  const { answers } = req.body;
  let score = 0;

  // 检查用户答案并计算得分
  answers.forEach((userAnswer, index) => {
    if (userAnswer === questions[index].answer) {
      score += 1;
    }
  });

  const userIdFromSession = req.session.user_id;

  try {
    let userInfo = await UserInfo.findOne({ userId: userIdFromSession });
    if (!userInfo) {
      // 如果找不到关联的 UserInfo 对象，则创建一个新的
      userInfo = new UserInfo({
        userId: userIdFromSession, // 将关联的 User 的 _id 存储在 userId 字段中
        testTimes: 0,
        testGrade: 0,
        testDate: null,
      });
    }

    // 更新用户的测试信息
    userInfo.testTimes += 1;
    userInfo.testGrade = score;
    userInfo.testDate = new Date();
    await userInfo.save();

    // 更新用户模型中的 userInfo 字段
    await User.findByIdAndUpdate(userIdFromSession, { userInfo: userInfo._id });
  } catch (error) {
    console.log(error);
    // 处理错误
  }

  console.log("User Score:", score);
  res.send({ score });
});

app.listen(3000, () => {
  console.log("sever success");
});
