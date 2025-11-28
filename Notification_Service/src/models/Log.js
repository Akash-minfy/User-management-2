const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["info", "error"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    meta: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true } // adds createdAt + updatedAt
);

module.exports = mongoose.model("Log", logSchema);
