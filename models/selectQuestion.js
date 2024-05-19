const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const selectQuestionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  questionIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
  ],
  examType: { type: String, required: true },
});

module.exports = mongoose.model("SelectQuestion", selectQuestionSchema);
