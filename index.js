import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api", async (req, res) => {
  res.json({
    apiName: "YanzAPI",
    apiUrl: "https://yanzapi.lol",
    status: "running",
    updatedAt: new Date().toISOString(),
    message:
      "Source website uses client-side rendering. Executor data is not accessible via server-side fetch.",
    data: [
      {
        name: "Executors List",
        status: "N/A",
        version: "N/A"
      }
    ]
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "YanzAPI is running",
    endpoint: "/api"
  });
});

app.listen(PORT, () => {
  console.log(`YanzAPI running on port ${PORT}`);
});
