const { chromium } = require('playwright');
const { randomUUID } = require('crypto');

// Parse --num-sessions / -s from argv without minimist.
const rawArgs = process.argv.slice(2);
let numSessions = 3;
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--num-sessions' || rawArgs[i] === '-s') {
    numSessions = parseInt(rawArgs[i + 1], 10);
    break;
  }
  const match = rawArgs[i].match(/^--num-sessions=(\d+)$/);
  if (match) {
    numSessions = parseInt(match[1], 10);
    break;
  }
}

const COLUMNS = 3;
const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 720;

(async () => {
  let closedCount = 0;

  for (let i = 0; i < numSessions; i++) {
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--window-position=${i % COLUMNS * PAGE_WIDTH},${Math.floor(i / COLUMNS) * PAGE_HEIGHT}`,
        `--window-size=${PAGE_WIDTH},${PAGE_HEIGHT}`,
      ],
    });
    const context = await browser.newContext();
    const sessionId = randomUUID();

    console.log(`Session ${i + 1}: ${sessionId}`);

    await context.addInitScript((id) => {
      window.localStorage.setItem('sessionId', id);
    }, sessionId);

    const page = await context.newPage();

    // Track page close
    page.on('close', () => {
      closedCount++;
      console.log(`❌ Page ${i + 1} closed (${closedCount}/${numSessions})`);
      if (closedCount === numSessions) {
        console.log('✅ All pages closed. Exiting.');
        process.exit(0);
      }
    });

    await page.goto('http://localhost:51455');
  }

  console.log(`🕵️‍♂️ All ${numSessions} pages launched. Close them to end the script.`);
})();
