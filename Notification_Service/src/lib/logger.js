function info(msg, meta) {
  // minimal logger; can be replaced
  if (meta) {
    console.log(msg, meta);
  } else {
    console.log(msg);
  }
}

function error(msg, meta) {
  if (meta) {
    console.error(msg, meta);
  } else {
    console.error(msg);
  }
}

module.exports = { info, error };


