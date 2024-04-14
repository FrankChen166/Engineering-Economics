const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userInfoSchema = new Schema({
  testTimes: Number,
  testGrade: Number,
  testDate: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model("UserInfo", userInfoSchema);
