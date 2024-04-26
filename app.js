const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const methodOverride = require("method-override");
const app = express();

const User = require("./models/user");
const UserInfo = require("./models/userInfo");
const Question = require("./models/questions");

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

  res.render("home", { username });
});

app.get("/upload", (req, res) => {
  res.render("upload");
});

// POST请求，处理上传的题目和答案
app.post("/upload", async (req, res) => {
  try {
    const { question, options, answer } = req.body;
    // 创建题目对象
    const newQuestion = new Question({
      question,
      options,
      answer,
    });
    // 保存题目到数据库
    await newQuestion.save();
    res.redirect("/upload"); // 上传成功后重定向到上传页面
  } catch (error) {
    console.error("Error uploading question:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/ex", async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect("/login");
    }
    // 从数据库中获取所有题目
    const questions = await Question.find({});
    res.render("ex", { questions });
  } catch (error) {
    console.error("Error rendering exam page:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/ex/submit", async (req, res) => {
  try {
    const { answers } = req.body;
    let score = 0;
    if (!req.session.user_id) {
      return res.redirect("/login");
    }

    const userIdFromSession = req.session.user_id;

    // 检查用户是否已经有了 UserInfo 记录
    let userInfo = await UserInfo.findOne({ userId: userIdFromSession });

    // 如果没有 UserInfo 记录，则创建新的记录
    if (!userInfo) {
      userInfo = new UserInfo({
        userId: userIdFromSession,
        tests: [],
      });
    }

    // 检查用户答案并计算得分
    const questions = await Question.find({});
    const testAnswers = [];
    answers.forEach(async (userAnswer, index) => {
      const question = questions[index];
      const isCorrect = userAnswer === question.answer;
      if (isCorrect) {
        score += 1;
      }
      // 将答案和正确与否记录到测试答案中
      testAnswers.push({
        questionId: question._id,
        userAnswer,
        isCorrect,
      });
    });

    // 更新用户考试信息
    const newTest = {
      testTimes: userInfo.tests.length + 1,
      testGrade: score,
      testDate: new Date(),
      answers: testAnswers,
    };

    userInfo.tests.push(newTest);
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
    console.error("Error submitting exam:", error);
    res.status(500).send("Internal Server Error");
  }
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

app.get("/info", async (req, res) => {
  const userId = req.session.user_id;

  try {
    const user = await User.findById(userId).populate("userInfo");

    if (
      !user ||
      !user.userInfo ||
      user.userInfo.length === 0 ||
      !user.userInfo[0].tests ||
      user.userInfo[0].tests.length === 0
    ) {
      return res.status(404).send("User or test information not found");
    }

    res.render("info", { user });
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).send("Internal Server Error");
  }
});

// app.get("/review", async (req, res) => {
//   try {
//     const userId = req.session.user_id;
//     const user = await User.findById(userId).populate("userInfo");

//     if (!user || !user.userInfo || user.userInfo.length === 0) {
//       return res.status(404).send("User or test information not found");
//     }

//     // 获取用户的测试信息
//     const userInfo = user.userInfo[0];

//     // 获取用户的测试答案
//     const testAnswers = userInfo.tests;

//     // 从数据库中获取所有问题的详细信息
//     const questions = await Question.find({});
//     res.render("review", { questions, testAnswers });

//   } catch (error) {
//     console.error("Error fetching review:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

app.get("/info/:testIndex", async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId).populate("userInfo");

    if (!user || !user.userInfo || user.userInfo.length === 0) {
      return res.status(404).send("User or test information not found");
    }

    // 获取用户的测试信息
    const userInfo = user.userInfo[0];

    // 获取用户的所有测试
    const tests = userInfo.tests;

    // 获取请求的测试索引
    const testIndex = req.params.testIndex;
    console.log(testIndex);

    // 检查请求的测试索引是否有效
    if (testIndex >= tests.length) {
      return res.status(404).send("Test not found");
    }

    // 获取请求的测试
    const requestedTest = tests[testIndex];

    // 从数据库中获取所有问题的详细信息
    const questions = await Question.find({});

    res.render("review", { requestedTest, questions, testIndex });
    //res.send(questions);
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
