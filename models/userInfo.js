const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const answerSchema = new Schema({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: "Question",
    required: true,
  },
  userAnswer: {
    type: String,
  },
  correctAnswer: {
    type: String,
  },
  isCorrect: {
    type: Boolean,
  },
});

const saveSchema = new Schema({
  saveTimes: {
    type: Number,
    required: true,
  },
  saveDate: {
    type: Date,
    required: true,
  },
  answers: [answerSchema],
  examType: { type: String, required: true },
});

const testSchema = new Schema({
  testTimes: Number,
  testGrade: Number,
  testDate: Date,
  answers: [answerSchema],
  examType: { type: String, required: true }, // 新增字段來區分測驗類型
});

const userInfoSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tests: [testSchema],
  saves: [saveSchema],
});

module.exports = mongoose.model("UserInfo", userInfoSchema);
