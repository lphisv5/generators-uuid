const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME";

function secureRandom(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

function checksum(data) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url")
    .slice(0, 6)
    .toUpperCase();
}

function generatePremiumUUIDv8() {
  const bytes = crypto.randomBytes(16);

  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const timeHash = crypto
    .createHash("sha1")
    .update(Date.now().toString())
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

  const partA = secureRandom(5);
  const partB = secureRandom(5);
  const partC = secureRandom(5);

  const base = `${PREFIX}-${timeHash}-${partA}-${partB}-${partC}`;
  const sign = checksum(base);

  return `${base}-${sign}`;
}

router.get("/uuid", (req, res) => {
  res.status(200).json({
    result: generatePremiumUUIDv8(),
    version: "UUID v8 (custom-secure)",
    issued_at: new Date().toISOString(),
  });
});

const app = express();
app.use("/api", router);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
