import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto("https://executors.samrat.lol/", {
      waitUntil: "networkidle2",
    });

    const executors = await page.evaluate(() => {
      const data = [];

      const cards = document.querySelectorAll(
        "div.bg-gray-800.rounded-lg"
      );

      cards.forEach(card => {
        const name =
          card.querySelector("h2")?.innerText.trim() ?? "Unknown";

        const version =
          card.querySelector("p")?.innerText
            .replace(/version/i, "")
            .trim() ?? "N/A";

        const status =
          card.querySelector("span")?.innerText.trim() ?? "Unknown";

        data.push({ name, version, status });
      });

      return data;
    });

    await browser.close();
    res.status(200).json(executors);

  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
}
