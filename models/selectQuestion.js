const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const selectQuestion = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  questionIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "Question",
      require: true,
    },
  ],
});

module.exports = mongoose.model("SelectQuestion", selectQuestionSchema);
