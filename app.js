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
const exportRouter = require("./export/export");
const { QuestionSet1, QuestionSet2 } = require("./models/questions");
const SelectQuestion = require("./models/selectQuestion");
const user = require("./models/user");

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "notgood" }));
app.use(methodOverride("_method"));
app.use("/", exportRouter);
// app.use("/", express.static(path.join(__dirname, "pic")));

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
  const shuffled = questions.sort(() => 0.5 - Math.random());
  for (let i = 0; i < num; i++) {
    selectedQuestions.push(shuffled[i]);
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
    const userId = req.session.user_id;

    if (userId) {
      let userInfo = await UserInfo.findOne({ userId });

      if (userInfo) {
        await userInfo.save();
      }
    }

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

app.post("/upload", async (req, res) => {
  try {
    const userId = req.session.user_id;

    const user = await User.findById(userId);

    if (user.role !== "teacher") {
      return res.status(403).send("Forbidden");
    }
    const { question, options, answer, examType, imagePath } = req.body;

    const newQuestion = {
      question,
      options,
      answer,
      imagePath,
    };
    if (examType === "exam1") {
      await new QuestionSet1(newQuestion).save();
    } else if (examType === "exam2") {
      await new QuestionSet2(newQuestion).save();
    } else {
      return res.status(400).send("Invalid exam type");
    }

    res.redirect("/upload");
  } catch (error) {
    console.error("Error uploading question:", error);
    res.status(500).send("Internal Server Error");
  }
});

async function renderExamPage(req, res, examType, QuestionSet) {
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
        tests: [],
      });
      await userInfo.save();
    }

    const questions = await QuestionSet.find({});
    let selectQuestions = await SelectQuestion.findOne({
      userId,
      examType,
    });
    if (!selectQuestions) {
      const randomQuestions = getRandomQuestions(questions, 10);
      selectQuestions = new SelectQuestion({
        userId: userId,
        questionIds: randomQuestions.map((question) => question._id),
        examType,
      });
      await selectQuestions.save();
    }

    const selectedQuestionIds = selectQuestions.questionIds;
    const selectedQuestionsContent = await QuestionSet.find({
      _id: { $in: selectedQuestionIds },
    });

    let savedAnswers = [];

    if (userInfo.saves.length > 0) {
      const latestSave = userInfo.saves
        .filter((save) => save.examType === examType)
        .slice(-1)[0];
      if (latestSave) {
        savedAnswers = latestSave.answers.map((answer) => ({
          questionId: answer.questionId.toString(),
          userAnswer: answer.userAnswer,
        }));
      }
    }
    console.log(selectedQuestionsContent);
    res.render("ex", {
      examType,
      selectedQuestionsContent,
      savedAnswers,
    });
  } catch (error) {
    console.error("Error rendering exam page:", error);
    res.status(500).send("Internal Server Error");
  }
}

async function handleSubmit(req, res, examType) {
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
      examType,
    });

    if (!selectQuestions) {
      return res.status(404).send("Selected questions not found for user.");
    }

    const selectedQuestionIds = selectQuestions.questionIds;
    const questionModel = examType === "exam1" ? QuestionSet1 : QuestionSet2;
    const selectedQuestions = await questionModel.find({
      _id: { $in: selectedQuestionIds },
    });

    const latestSave = userInfo.saves
      .filter((save) => save.examType === examType)
      .slice(-1)[0] || { answers: [] };
    const previousAnswers = latestSave.answers;

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
        examType,
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
        examType,
      };
      userInfo.tests.push(newTest);
      await userInfo.save();

      const user = await User.findById(userIdFromSession).populate("userInfo");
      if (examType === "exam1") {
        user.firstScore = score;
      } else if (examType === "exam2") {
        user.secondScore = score;
      }
      const existingUserInfoIndex = user.userInfo.findIndex(
        (info) => info._id.toString() === userInfo._id.toString()
      );
      if (existingUserInfoIndex === -1) {
        user.userInfo.push(userInfo);
      }
      await user.save();
      res.redirect(
        `/result?userId=${userInfo.userId}&userInfoId=${userInfo._id}`
      );
    }
  } catch (error) {
    console.error("Error submitting exam:", error);
    res.status(500).send("Internal Server Error");
  }
}

async function renderReview(req, res, examType, QuestionSet) {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId).populate("userInfo");

    if (!user || !user.userInfo || user.userInfo.length === 0) {
      return res.status(404).send("User or test information not found");
    }

    const userInfo = user.userInfo[0];
    const tests = userInfo.tests;
    const testIndex = req.params.testIndex;

    if (testIndex >= tests.length) {
      return res.status(404).send("Test not found");
    }

    const requestedTest = tests[testIndex];
    console.log(requestedTest);

    const questionIds = requestedTest.answers.map(
      (answer) => answer.questionId
    );
    const questions = await QuestionSet.find({ _id: { $in: questionIds } });

    // Create a dictionary to map question IDs to questions
    const questionDict = {};
    questions.forEach((question) => {
      questionDict[question._id] = question;
    });

    // Associate each answer with its corresponding question
    requestedTest.answers.forEach((answer) => {
      answer.question = questionDict[answer.questionId];
    });

    res.render("review", {
      requestedTest,
      testIndex,
      user,
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).send("Internal Server Error");
  }
}

app.get("/ex1", async (req, res) => {
  await renderExamPage(req, res, "exam1", QuestionSet1);
});

app.get("/ex2", async (req, res) => {
  await renderExamPage(req, res, "exam2", QuestionSet2);
});

app.post("/exam1/submit", async (req, res) => {
  await handleSubmit(req, res, "exam1");
});

app.post("/exam2/submit", async (req, res) => {
  await handleSubmit(req, res, "exam2");
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
  try {
    const user = await User.findById(userId).populate("userInfo");
    console.log(user);
    const userInfo = user.userInfo[0];
    // if (!user || !user.userInfo || user.userInfo.length === 0) {
    //   return res.status(404).send("User or test information not found");
    // }
    if (!userInfo) {
      res.render("info", { user });
    } else {
      const testTimes = userInfo.tests.map((test, index) => ({
        testTimes: index,
        date: test.testDate,
      }));

      res.render("info", { user, testTimes });
    }
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).send("Internal Server Error");
  }
});

const getQuestionsAndPopulateAnswers = async (
  QuestionModel,
  questionIds,
  requestedTest
) => {
  const questions = await QuestionModel.find({ _id: { $in: questionIds } });
  const questionDict = {};
  questions.forEach((question) => {
    questionDict[question._id.toString()] = question;
  });

  requestedTest.answers.forEach((answer) => {
    const question = questionDict[answer.questionId.toString()];
    if (question) {
      answer.question = question.question;
      answer.options = question.options;
      answer.correctAnswer = question.answer;
    } else {
      answer.question = "Question not found";
      answer.options = [];
      answer.correctAnswer = "Answer not found";
    }
  });
};

app.get("/info/:testIndex", async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).populate("userInfo");

    const userInfo = user.userInfo[0];
    const tests = userInfo.tests;
    const testIndex = parseInt(req.params.testIndex, 10);
    console.log(testIndex);
    if (isNaN(testIndex) || testIndex >= tests.length || testIndex < 0) {
      return res.status(404).send("Test not found");
    }

    const requestedTest = tests[testIndex];
    const questionIds = requestedTest.answers.map(
      (answer) => answer.questionId
    );

    const QuestionModel = testIndex === 0 ? QuestionSet1 : QuestionSet2;
    await getQuestionsAndPopulateAnswers(
      QuestionModel,
      questionIds,
      requestedTest
    );

    res.render("review", {
      requestedTest,
      user,
      testIndex,
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/classSelect", async (req, res) => {
  res.render("classSelect");
});

app.get("/class/:className", async (req, res) => {
  try {
    const className = req.params.className;
    const students = await User.find({ CLASS: className, role: "student" });

    const user = await User.find({});

    res.render("studentList", { user, className, students });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/class/:className/:id", async (req, res) => {
  // 检查用户是否登录
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  try {
    const userId = req.session.user_id;

    // 检查用户是否为教师
    const user = await User.findById(userId);
    if (!user || user.role !== "teacher") {
      return res.status(403).send("Forbidden");
    }

    const studentId = req.params.id;
    const student = await User.findById(studentId).populate("userInfo");

    // 确保学生存在
    if (!student) {
      return res.status(404).send("Student not found");
    }

    res.render("studentInfo", { users: student });
  } catch (error) {
    console.error("Error fetching student info:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
