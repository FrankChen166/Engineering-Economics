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
});

const userInfoSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tests: [
    {
      testTimes: Number,
      testGrade: Number,
      testDate: Date,
      answers: [answerSchema],
    },
  ],
  saves: [saveSchema],
});

module.exports = mongoose.model("UserInfo", userInfoSchema);
