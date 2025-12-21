import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

function generatePremiumUUID() {
  const part1 = randomString(5);
  const part2 = randomString(4);
  const part3 = randomString(5);
  const part4 = randomString(4);
  const part5 = randomString(6);
  return `YZ-${part1}-${part2}-${part3}-${part4}-${part5}`;
}

app.get("/api/uuid", (req, res) => {
  res.json({
    result: generatePremiumUUID(),
    version: "v8",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
