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
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
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
});

module.exports = mongoose.model("UserInfo", userInfoSchema);
