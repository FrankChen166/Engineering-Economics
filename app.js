const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const methodOverride = require("method-override");
const app = express();

const User = require("./models/user");
const UserInfo = require("./models/userInfo");

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "notgood" }));
app.use(methodOverride("_method"));

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
  const { username, studentId, CLASS, useraccount, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const user = new User({
    username,
    studentId,
    CLASS,
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

// app.post("/logout", (req, res) => {
//   req.session.user_id = null;
//   res.redirect("/login");
// });

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Internal Server Error");
    }
    res.redirect("/login");
  });
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
  if (!req.session.user_id) {
    return res.redirect("/login");
  }
  res.render("ex", { questions });
});
app.post("/ex/submit", async (req, res) => {
  const { answers } = req.body;
  let score = 0;
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  const userIdFromSession = req.session.user_id;

  try {
    // 检查用户是否已经有了 UserInfo 记录
    let userInfo = await UserInfo.findOne({ userId: userIdFromSession });

    // 如果没有 UserInfo 记录，则创建新的记录
    if (!userInfo) {
      userInfo = new UserInfo({
        userId: userIdFromSession,
        testTimes: [],
        testGrade: [],
        testDate: [],
      });
    }

    // 检查用户是否已经考试两次
    // if (userInfo.testTimes.length >= 2) {
    //   return res.send("您已经考试两次，不能再参加考试。");
    // }

    // 检查用户答案并计算得分
    answers.forEach((userAnswer, index) => {
      if (userAnswer === questions[index].answer) {
        score += 1;
      }
    });

    // 更新用户考试信息
    userInfo.testTimes.push(userInfo.testTimes.length + 1); // 每次考试次数加 1
    userInfo.testGrade.push(score); // 添加当前考试分数
    userInfo.testDate.push(new Date()); // 添加当前考试日期
    await userInfo.save();

    // 将新的 UserInfo 对象关联到用户模型中
    const user = await User.findById(userIdFromSession).populate("userInfo");

    const existingUserInfoIndex = user.userInfo.findIndex(
      (info) => info._id.toString() === userInfo._id.toString()
    );

    // 将新的测试结果添加到用户的测试结果数组中
    if (existingUserInfoIndex === -1) {
      user.userInfo.push(userInfo);
    }

    // 保存用户模型
    await user.save();

    res.redirect(`/result?userId=${user._id}&userInfoId=${userInfo._id}`);
  } catch (error) {
    console.log(error);
    // 处理错误
    res.status(500).send("Internal Server Error");
    return;
  }

  console.log("User Score:", score);
});

app.get("/result", async (req, res) => {
  const userId = req.query.userId;

  const userInfoId = req.query.userInfoId;

  const user = await User.findById(userId).populate("userInfo");
  const userInfo = user.userInfo.find(
    (info) => info._id.toString() === userInfoId
  );
  res.render("result", { user, userInfo });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
