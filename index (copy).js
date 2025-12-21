const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";

app.get("/executors", async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log("Navigating to https://executors.samrat.lol/");
    await page.goto("https://executors.samrat.lol/", { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    // await page.screenshot({ path: 'debug.png', fullPage: true });

    // Extract executors data
    const executors = await page.evaluate(() => {
      const executorsList = [];

      // Find all executor cards - look for divs with specific structure
      const cards = document.querySelectorAll('div.bg-gray-800.rounded-lg, div[class*="bg-gray"][class*="rounded"], div.shadow-lg, div.border, div.border-gray-700');

      // Alternative: Look for any div that might contain executor info
      const allDivs = document.querySelectorAll('div');
      const potentialCards = [];

      allDivs.forEach(div => {
        const text = div.innerText || '';
        const hasExecutorName = /arceus|codex|cryptic|delta|jjsploit|executor/i.test(text);
        const hasVersion = /version|v\d|\.\d/.test(text);
        const hasStatus = /online|offline|status/i.test(text);

        if ((hasExecutorName || hasVersion || hasStatus) && text.split('\n').length >= 3) {
          potentialCards.push(div);
        }
      });

      // Process potential cards
      const cardsToProcess = cards.length > 0 ? cards : potentialCards;

      cardsToProcess.forEach(card => {
        try {
          const cardText = card.innerText || '';
          const lines = cardText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

          if (lines.length >= 3) {
            let name = null;
            let version = null;
            let status = null;

            // Find name (look for executor names)
            for (const line of lines) {
              const lowerLine = line.toLowerCase();
              if (lowerLine.includes('arceus') || lowerLine.includes('codex') || 
                  lowerLine.includes('cryptic') || lowerLine.includes('delta') || 
                  lowerLine.includes('jjsploit') || lowerLine.includes('executor')) {
                name = line;
                break;
              }
            }

            // Find version (look for version or vX.X.X pattern)
            for (const line of lines) {
              if (line.toLowerCase().includes('version') || /v?\d+\.\d+/.test(line)) {
                version = line.replace(/version/i, '').trim();
                break;
              }
            }

            // Find status (look for online/offline)
            for (const line of lines) {
              const lowerLine = line.toLowerCase();
              if (lowerLine.includes('online') || lowerLine.includes('offline') || lowerLine.includes('status')) {
                status = line;
                break;
              }
            }

            // If we found a name, add to list
            if (name) {
              executorsList.push({
                name: name,
                version: version || 'N/A',
                status: status || 'Unknown'
              });
            }
          }
        } catch (e) {
          console.error('Error processing card:', e);
        }
      });

      return executorsList;
    });

    // If the above method doesn't work, try getting all text and parsing it
    if (executors.length === 0) {
      console.log("Trying alternative parsing method...");

      const pageText = await page.evaluate(() => {
        return document.body.innerText;
      });

      // Parse the text to find executors
      const lines = pageText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      const parsedExecutors = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // Check if this line contains executor name
        if (lowerLine.includes('arceus') || lowerLine.includes('codex') || 
            lowerLine.includes('cryptic') || lowerLine.includes('delta') || 
            lowerLine.includes('jjsploit')) {

          const executor = { name: line, version: 'N/A', status: 'Unknown' };

          // Look ahead for version and status
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j].toLowerCase();
            if (nextLine.includes('version') || /v?\d+\.\d+/.test(nextLine)) {
              executor.version = lines[j].replace(/version/i, '').trim();
            }
            if (nextLine.includes('online') || nextLine.includes('offline')) {
              executor.status = lines[j];
            }
          }

          parsedExecutors.push(executor);
        }
      }

      if (parsedExecutors.length > 0) {
        await browser.close();
        return res.json(parsedExecutors);
      }
    }

    await browser.close();

    // Return data or empty array
    if (executors.length === 0) {
      console.log("No executors found. Website structure may have changed.");
      res.json([]);
    } else {
      // Filter to get only the executors you mentioned
      const filteredExecutors = executors.filter(e => 
        ['Arceus X', 'Codex', 'Cryptic', 'Delta', 'JJsploit']
          .some(name => e.name.toLowerCase().includes(name.toLowerCase().replace(' x', '')))
      );

      // Clean up the data
      const cleanedExecutors = filteredExecutors.map(e => ({
        name: e.name.includes('Arceus') ? 'Arceus X' : 
              e.name.includes('Codex') ? 'Codex' :
              e.name.includes('Cryptic') ? 'Cryptic' :
              e.name.includes('Delta') ? 'Delta' :
              e.name.includes('JJsploit') ? 'JJsploit' : e.name,
        version: e.version,
        status: e.status.includes('Online') ? 'Online' : 
                e.status.includes('Offline') ? 'Offline' : e.status
      }));

      res.json(cleanedExecutors);
    }

  } catch (err) {
    console.error("Error:", err);
    if (browser) await browser.close();
    res.status(500).json({ 
      error: "Cannot fetch data", 
      details: err.message,
      suggestion: "The website structure may have changed or is blocking requests."
    });
  }
});

app.listen(PORT, HOST, () => console.log(`API running on ${HOST}:${PORT}`));