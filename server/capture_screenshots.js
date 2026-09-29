const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log('Launching browser for portfolio screenshots...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  try {
    // 1. Login Page
    console.log('1. Capturing Login Page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="email"]');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_login_page.png') });

    // 2. Perform Login
    console.log('2. Logging in...');
    await page.type('input[name="email"]', 'demo@taskflow.dev');
    await page.type('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. Dashboard
    console.log('3. Capturing Dashboard...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.waitForSelector('h1');
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_dashboard_overview.png') });

    // 4. Workspaces Page
    console.log('4. Capturing Workspaces Page...');
    await page.goto('http://localhost:5173/workspaces', { waitUntil: 'networkidle2' });
    await page.waitForSelector('h1');
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_workspaces_management.png') });

    // 5. Kanban Board
    console.log('5. Navigating to Kanban Board...');
    // Click on the first board link
    const boardLink = await page.$('div[class*="cursor-pointer"]');
    if (boardLink) {
      await boardLink.click();
    } else {
      await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
      const firstWs = await page.$('div[class*="cursor-pointer"]');
      if (firstWs) await firstWs.click();
    }
    await new Promise((r) => setTimeout(r, 1500));
    console.log('6. Capturing Kanban Board...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_kanban_board_full.png') });

    // 6. Open Task Detail Modal
    console.log('7. Opening Task Detail Modal...');
    const taskCard = await page.$('div[class*="group relative bg-[#181b24]"]');
    if (taskCard) {
      await taskCard.click();
      await new Promise((r) => setTimeout(r, 800));
      console.log('8. Capturing Task Detail Modal (Details)...');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_task_detail_modal.png') });

      // Click Comments Tab
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (text && text.includes('Comments')) {
          await btn.click();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      console.log('9. Capturing Task Comments Tab...');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_task_comments_discussion.png') });

      // Close modal
      const closeBtn = await page.$('button[class*="hover:text-zinc-100"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // 7. Open Label Manager Modal
    console.log('10. Opening Label Manager Modal...');
    const labelButtons = await page.$$('button');
    for (const btn of labelButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Labels')) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));
    console.log('11. Capturing Label Manager...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_label_manager.png') });

    console.log('All screenshots captured successfully in:', SCREENSHOTS_DIR);
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

main();
