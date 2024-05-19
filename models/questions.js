const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], require: true },
  answer: { type: String, required: true },
});

const QuestionSet1 = mongoose.model("QuestionSet1", questionSchema);
const QuestionSet2 = mongoose.model("QuestionSet2", questionSchema);

module.exports = { QuestionSet1, QuestionSet2 };
