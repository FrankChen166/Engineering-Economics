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

  let role = "student"; // 默认为学生角色

  // 检查是否是特定的教师帐户
  if (studentId === "M11218017") {
    role = "teacher";
  }
  const hash = await bcrypt.hash(password, 12);
  const user = new User({
    username,
    studentId,
    CLASS,
    useraccount,
    password: hash,
    role: role,
  });
  await user.save();
  req.session.user_id = user.id;
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    const vaildPassword = await bcrypt.compare(password, user.password);
    const userId = req.session.user_id;

    if (vaildPassword) {
      req.session.user_id = user._id;
      req.session.username = user.username;

      // 检查是否存在保存的记录，并在必要时加载到会话中
      const userInfo = await UserInfo.findOne({ userId: user._id });
      if (userInfo && userInfo.saves.length > 0) {
        req.session.loadSavedProgress = true;
      } else {
        req.session.loadSavedProgress = false;
      }

      res.redirect("/home");
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/logout", async (req, res) => {
  try {
    // 获取用户的 ID
    const userId = req.session.user_id;
    // 如果用户已经登录
    if (userId) {
      // 找到用户信息
      let userInfo = await UserInfo.findOne({ userId });
      // 如果找到用户信息
      if (userInfo) {
        // 将保存的进度信息保存到数据库中
        await userInfo.save();
      }
    }
    // 销毁会话信息
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/home", (req, res) => {
  const { username } = req.session;
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  res.render("home", { username });
});

app.get("/upload", async (req, res) => {
  const userId = req.session.user_id;

  const user = await User.findById(userId);

  if (user.role !== "teacher") {
    return res.status(403).send("Forbidden");
  }
  res.render("upload");
});

// POST请求，处理上传的题目和答案
app.post("/upload", async (req, res) => {
  try {
    const userId = req.session.user_id;

    const user = await User.findById(userId);

    if (user.role !== "teacher") {
      return res.status(403).send("Forbidden");
    }
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
    const userId = req.session.user_id;
    let userInfo = await UserInfo.findOne({ userId });

    if (!userInfo) {
      // 如果用户信息不存在，则创建新的用户信息对象
      userInfo = new UserInfo({
        userId: userId,
        saves: [], // 初始化保存记录为空数组
      });
      await userInfo.save();
    }

    // 从数据库中获取所有题目
    const questions = await Question.find({});

    const loadSavedProgress = req.session.loadSavedProgress;
    req.session.loadSavedProgress = false;
    const savedProgress = loadSavedProgress ? userInfo.saves : [];

    res.render("ex", { questions, savedProgress });
  } catch (error) {
    console.error("Error rendering exam page:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/ex/save", async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }
    req.session.loadSavedProgress = true;
    // 找到用户信息
    let userInfo = await UserInfo.findOne({ userId });
    const selectedAnswers = req.body.answers;

    // 创建一个新的 save 对象
    const newSave = {
      saveTimes: userInfo.saves.length + 1, // 获取当前保存次数
      saveDate: new Date(),
      answers: [],
    };

    // 获取所有问题的 ID
    const questionIds = await Question.find({}).select("_id");

    // 遍历表单中的选项，并添加到 newSave.answers 中
    Object.keys(selectedAnswers).forEach((index) => {
      const questionIndex = parseInt(index);
      Object.keys(selectedAnswers[index]).forEach((optionIndex) => {
        const answer = selectedAnswers[index][optionIndex];
        if (answer) {
          // 检查 userInfo.tests 数组长度是否足够覆盖当前问题索引
          if (userInfo.tests.length <= questionIndex) {
            userInfo.tests.push({}); // 如果不够，则添加空对象
          }
          // 获取问题的 _id
          const questionId = questionIds[questionIndex]._id;
          if (questionId) {
            // 确保问题有 _id 属性
            newSave.answers.push({
              questionId,
              userAnswer: answer,
            });
          }
        }
      });
    });

    // 更新用户的保存记录，覆盖上一次的保存记录
    userInfo.saves.push(newSave);

    // 保存用户信息
    await userInfo.save();

    res.redirect("/home");
  } catch (e) {
    console.error("Error saving progress:", e);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/save", async (req, res) => {
  const userId = req.session.user_id;
  let userInfo = await UserInfo.findOne({ userId }).populate("saves");
  res.send(userInfo.saves);
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
    const index = { A: 0, B: 1, C: 2, D: 3 };

    res.render("review", { requestedTest, questions, testIndex, index });
    //res.send(questions);
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/allStudent", async (req, res) => {
  // 将路由路径更正为 /allStudent
  const userId = req.session.user_id;
  const user = await User.findById(userId);
  if (user.role !== "teacher") {
    // 如果不是老师，重定向到其他页面或显示错误消息
    return res.status(403).send("Forbidden");
  }
  const users = await User.find({});

  res.render("allStudent", { users, userId });
});

app.get("/allStudent/:id", async (req, res) => {
  // 检查用户是否登录
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.user_id;

    const user = await User.findById(userId);

    if (user.role !== "teacher") {
      return res.status(403).send("Forbidden");
    }

    const studentId = req.params.id;
    const users = await User.findById(studentId).populate("userInfo");

    res.render("allStudentInfo", { users });
  } catch (error) {
    console.error("Error fetching student info:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
