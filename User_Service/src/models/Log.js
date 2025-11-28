const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    level: { type: String, required: true },
    message: { type: String, required: true },
    args: { type: Object }, // extra info you pass
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
