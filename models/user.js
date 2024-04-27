const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: [true, "name cannot be blank"] },
  studentId: { type: String, required: [true, "studentId cannot be blank"] },
  CLASS: { type: String, required: [true, "class cannot be blank"] },
  useraccount: { type: String, required: [true, "Useraccunt cannot be blank"] },
  password: { type: String, required: [true, "Password cannot be blank"] },
  role: { type: String, enum: ["teacher", "student"], default: "student" },
  userInfo: [
    {
      type: Schema.Types.ObjectId,
      ref: "UserInfo",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
