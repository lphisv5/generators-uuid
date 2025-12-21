import { chromium } from "playwright";

export default async function handler(req, res) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("https://executors.samrat.lol/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // รอ content render

    const executors = await page.$$eval(".card", cards =>
      cards.map(card => ({
        name: card.querySelector("h3")?.innerText || null,
        version: card.querySelector(".version")?.innerText || "N/A",
        status: card.querySelector(".status")?.innerText || "Unknown"
      }))
    );

    await browser.close();
    res.status(200).json(executors);

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: "Cannot fetch data", details: err.message });
  }
}
