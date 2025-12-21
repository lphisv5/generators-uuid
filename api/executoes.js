import axios from "axios";
import cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const { data } = await axios.get("https://executors.samrat.lol/");
    const $ = cheerio.load(data);

    const results = [];

    $("div").each((_, el) => {
      const text = $(el).text();
      if (/arceus|codex|cryptic|delta|jjsploit/i.test(text)) {
        results.push(text.trim());
      }
    });

    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
