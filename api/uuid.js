const crypto = require("crypto");

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* memory store (1 user = 1 key) */
const users = new Map();

/* RANDOM STRING */
function secureRandom(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return result;
}

/* GENERATE KEY */
function generateKey() {
  return `${PREFIX}-${secureRandom(5)}-${secureRandom(5)}-${secureRandom(5)}`;
}

/* USER FINGERPRINT */
function getUserId(req) {

  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown";

  const agent = req.headers["user-agent"] || "unknown";

  return crypto
    .createHash("sha256")
    .update(ip + agent)
    .digest("hex");
}

/* API */
module.exports = (req, res) => {

  const userId = getUserId(req);

  /* ถ้ามีคีย์แล้ว */
  if (users.has(userId)) {
    return res.json({
      key: users.get(userId)
    });
  }

  /* ถ้ายังไม่มีคีย์ */
  const key = generateKey();

  users.set(userId, key);

  res.json({
    key
  });

};
