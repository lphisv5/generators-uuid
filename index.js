import express from "express";
import { randomUUID } from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

function randomDigits(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generatePremiumUUID() {
  const part1 = randomDigits(5);
  const part2 = randomDigits(4);
  const part3 = randomDigits(5);
  const part4 = randomDigits(4);
  const part5 = randomDigits(6);
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
