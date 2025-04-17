const { chromium } = require("playwright");
const { v4: uuidv4 } = require("uuid");
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  alias: { s: 'num-sessions' },
  default: { 'num-sessions': 3 },
});

const COLUMNS = 3;
const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 720;

(async () => {
  let closedCount = 0;

  const numSessions = parseInt(args['num-sessions'], 10);

  for (let i = 0; i < numSessions; i++) {
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--window-position=${i % COLUMNS * PAGE_WIDTH},${Math.floor(i / COLUMNS) * PAGE_HEIGHT}`,
        `--window-size=${PAGE_WIDTH},${PAGE_HEIGHT}`
      ]
    });
    const context = await browser.newContext();
    const sessionId = uuidv4();

    console.log(`Session ${i + 1}: ${sessionId}`);

    await context.addInitScript((id) => {
      window.localStorage.setItem("sessionId", id);
    }, sessionId);

    const page = await context.newPage();

    // Track page close
    page.on("close", () => {
      closedCount++;
      console.log(`❌ Page ${i + 1} closed (${closedCount}/${numSessions})`);
      if (closedCount === numSessions) {
        console.log("✅ All pages closed. Exiting.");
        process.exit(0);
      }
    });

    await page.goto("http://localhost:5143");
  }

  console.log(`🕵️‍♂️ All ${numSessions} pages launched. Close them to end the script.`);
})();
