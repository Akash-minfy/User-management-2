const Log = require("../models/Log");

async function saveToDb(level, message, meta) {
  try {
    await Log.create({ level, message, meta });
  } catch (err) {
    console.error("Failed to save log:", err);
  }
}

function info(msg, meta) {
  if (meta) {
    console.log("[INFO]", msg, meta);
  } else {
    console.log("[INFO]", msg);
  }

  saveToDb("info", msg, meta);
}

function error(msg, meta) {
  if (meta) {
    console.error("[ERROR]", msg, meta);
  } else {
    console.error("[ERROR]", msg);
  }

  saveToDb("error", msg, meta);
}

module.exports = { info, error };
