const express = require("express");
const crypto = require("crypto");

const app = express();
const router = express.Router();

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME_SECRET";

/* RANDOM */
function secureRandom(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return result;
}

/* SIGNATURE */
function checksum(data) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url")
    .slice(0, 6)
    .toUpperCase();
}

/* TIME HASH */
function timeHash() {
  return crypto
    .createHash("sha1")
    .update(Date.now().toString())
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

/* GENERATE */
function generatePremiumUUIDv8() {
  const partA = secureRandom(5);
  const partB = secureRandom(5);
  const partC = secureRandom(5);

  const base = `${PREFIX}-${timeHash()}-${partA}-${partB}-${partC}`;
  const sign = checksum(base);

  return `${base}-${sign}`;
}

/* VERIFY */
function verifyUUID(uuid) {
  const parts = uuid.split("-");

  if (parts.length !== 6) return false;

  const sign = parts.pop();
  const base = parts.join("-");

  const expected = checksum(base);

  return sign === expected;
}

/* MAIN ENDPOINT */
router.get("/", (req, res) => {

  const verifyParam = req.query.verify;

  if (verifyParam) {
    const valid = verifyUUID(verifyParam);

    return res.json({
      uuid: verifyParam,
      valid
    });
  }

  const uuid = generatePremiumUUIDv8();

  res.json({
    uuid,
    version: "v8-premium"
  });

});

app.use("/", router);

module.exports = app;
