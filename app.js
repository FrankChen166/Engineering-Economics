const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const methodOverride = require("method-override");
const fs = require("fs");
const path = require("path");

const app = express();

const User = require("./models/user");
const UserInfo = require("./models/userInfo");
const Question = require("./models/questions");
const SelectQuestion = require("./models/selectQuestion");
const user = require("./models/user");

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

function getRandomQuestions(questions, num) {
  const selectedQuestions = [];
  const shuffled = questions.sort(() => 0.5 - Math.random()); // 随机排序
  for (let i = 0; i < num; i++) {
    selectedQuestions.push(shuffled[i]); // 选择前 num 个题目
  }
  return selectedQuestions;
}

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

app.get("/home", async (req, res) => {
  const userId = req.session.user_id;

  const user = await User.findById(userId);
  const userinfo = await UserInfo.findOne({ userId });

  let testTimes = 0;
  if (userinfo) {
    testTimes = userinfo.tests.length;
  }

  const { username } = req.session;
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  res.render("home", { username, user, userinfo, testTimes });
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
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    let userInfo = await UserInfo.findOne({ userId });
    if (!userInfo) {
      userInfo = new UserInfo({
        userId: userId,
        saves: [],
      });
      await userInfo.save();
    }

    const questions = await Question.find({});
    let selectQuestions = await SelectQuestion.findOne({ userId });
    if (!selectQuestions) {
      const randomQuestions = getRandomQuestions(questions, 3);
      selectQuestions = new SelectQuestion({
        userId: userId,
        questionIds: randomQuestions.map((question) => question._id),
      });
      await selectQuestions.save();
    }

    const selectedQuestionIds = selectQuestions.questionIds;
    const selectedQuestionsContent = await Question.find({
      _id: { $in: selectedQuestionIds },
    });

    let savedAnswers = [];
    if (userInfo.saves.length > 0) {
      const latestSave = userInfo.saves[userInfo.saves.length - 1];
      savedAnswers = latestSave.answers.map((answer) => ({
        questionId: answer.questionId.toString(),
        userAnswer: answer.userAnswer,
      }));
    }

    res.render("ex", { selectedQuestionsContent, savedAnswers });
  } catch (error) {
    console.error("Error rendering exam page:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/ex/submit", async (req, res) => {
  try {
    const { answersObject, saveOnly } = req.body;
    let score = 0;
    if (!req.session.user_id) {
      return res.redirect("/login");
    }

    const userIdFromSession = req.session.user_id;
    const answers = JSON.parse(answersObject);

    let userInfo = await UserInfo.findOne({ userId: userIdFromSession });

    if (!userInfo) {
      userInfo = new UserInfo({
        userId: userIdFromSession,
        tests: [],
        saves: [],
      });
    }

    const selectQuestions = await SelectQuestion.findOne({
      userId: userIdFromSession,
    });

    if (!selectQuestions) {
      return res.status(404).send("Selected questions not found for user.");
    }

    const selectedQuestionIds = selectQuestions.questionIds;
    const selectedQuestions = await Question.find({
      _id: { $in: selectedQuestionIds },
    });

    const latestSave = userInfo.saves[userInfo.saves.length - 1] || {
      answers: [],
    };
    const previousAnswers = latestSave.answers;
    console.log(previousAnswers);
    const testAnswers = selectedQuestions.map((question) => {
      const previousAnswer = previousAnswers.find((answer) =>
        answer.questionId.equals(question._id)
      );
      const userAnswer =
        answers[question._id.toString()] ||
        (previousAnswer && previousAnswer.userAnswer) ||
        null;
      const isCorrect = userAnswer === question.answer;
      if (userAnswer && isCorrect) {
        score += 1;
      }
      return {
        questionId: question._id,
        userAnswer,
        correctAnswer: question.answer,
        isCorrect,
      };
    });

    testAnswers.forEach((answer) => {
      const index = previousAnswers.findIndex((a) =>
        a.questionId.equals(answer.questionId)
      );
      if (index !== -1) {
        previousAnswers[index] = answer;
      } else {
        previousAnswers.push(answer);
      }
    });

    if (saveOnly === "true") {
      const newSave = {
        saveTimes: userInfo.saves.length + 1,
        saveDate: new Date(),
        answers: previousAnswers,
      };

      userInfo.saves.push(newSave);
      await userInfo.save();
      res.redirect("/home");
    } else {
      const newTest = {
        testTimes: userInfo.tests.length + 1,
        testGrade: score,
        testDate: new Date(),
        answers: testAnswers,
      };

      userInfo.tests.push(newTest);
      await userInfo.save();

      const user = await User.findById(userIdFromSession).populate("userInfo");

      const existingUserInfoIndex = user.userInfo.findIndex(
        (info) => info._id.toString() === userInfo._id.toString()
      );

      if (existingUserInfoIndex === -1) {
        user.userInfo.push(userInfo);
      }

      await user.save();
      // const { username, studentId } = user;

      // // 将新测试的内容保存到JSON文件中
      // const jsonData = JSON.stringify(
      //   {
      //     username,
      //     studentId,
      //     testGrade: newTest.testGrade,
      //   },
      //   null,
      //   2
      // );
      // const filePath = path.join(
      //   __dirname,
      //   "grade",
      //   `${studentId}-${username}.json`
      // );

      // fs.writeFile(filePath, jsonData, (err) => {
      //   if (err) {
      //     console.error("Error writing JSON file:", err);
      //   } else {
      //     console.log("JSON file has been saved.");
      //   }
      // });

      res.redirect(
        `/result?userId=${userInfo.userId}&userInfoId=${userInfo._id}`
      );
    }
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
  console.log(userInfo);
  // res.send(user);
  res.render("result", { user, userInfo });
});

app.get("/info", async (req, res) => {
  const userId = req.session.user_id;
  console.log(userId);

  try {
    const user = await User.findById(userId).populate("userInfo");
    console.log(user);
    // if (
    //   !user ||
    //   !user.userInfo ||
    //   user.userInfo.length === 0 ||
    //   !user.userInfo[0].tests ||
    //   user.userInfo[0].tests.length === 0
    // ) {
    //   return res.status(404).send("User or test information not found");
    // }

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

    const userInfo = user.userInfo[0];

    const tests = userInfo.tests;

    const testIndex = req.params.testIndex;
    console.log(testIndex);

    if (testIndex >= tests.length) {
      return res.status(404).send("Test not found");
    }

    const requestedTest = tests[testIndex];
    // console.log(requestedTest);

    const questionIds = requestedTest.answers.map(
      (answer) => answer.questionId
    );
    // console.log(questionIds);
    const questions = await Question.find({ _id: { $in: questionIds } });
    // console.log(questions);
    const questionDict = {};
    questions.forEach((question) => {
      questionDict[question._id] = question;
    });
    console.log(questionDict);
    requestedTest.answers.forEach((answer) => {
      answer.question = questionDict[answer.questionId];
    });
    // console.log(answer.question);
    const index = { A: 0, B: 1, C: 2, D: 3 };

    res.render("review", {
      requestedTest,
      testIndex,
      user,
    });
    // res.send(user);
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
