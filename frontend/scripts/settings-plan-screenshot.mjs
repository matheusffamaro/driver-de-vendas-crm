#!/usr/bin/env node
/**
 * Settings Plan Tab - Screenshot script
 * Logs in, navigates to settings plan tab, captures screenshots.
 * Run: npx playwright test scripts/settings-plan-screenshot.mjs (after installing playwright)
 * Or: node scripts/settings-plan-screenshot.mjs (uses playwright from node_modules)
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../cypress/screenshots/settings-plan-screenshot');

async function main() {
  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // 1. Login page
    await page.goto('http://localhost:3100/auth/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });
    console.log('Screenshot 1: Login page');

    // 2. Fill login form and submit
    await page.fill('input[name="email"]', 'admin@crm.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-login-dashboard.png'), fullPage: true });
    console.log('Screenshot 2: After login');

    // 3. Navigate to settings plan tab
    await page.goto('http://localhost:3100/settings?tab=plan', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-plan-tab-overview.png'), fullPage: true });
    console.log('Screenshot 3: Plan tab overview');

    // 4. Subscription details (already in view)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-subscription-details-cards.png'), fullPage: true });
    console.log('Screenshot 4: Subscription details');

    // 5. Scroll to Histórico de Pagamentos
    await page.locator('text=Histórico de Pagamentos').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-historico-pagamentos.png'), fullPage: true });
    console.log('Screenshot 5: Histórico de Pagamentos');

    // 6. Scroll to Cancelar Assinatura
    await page.locator('text=Cancelar Assinatura').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-cancelar-assinatura.png'), fullPage: true });
    console.log('Screenshot 6: Cancelar Assinatura');

    // 7. Full page
    await page.goto('http://localhost:3100/settings?tab=plan', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-plan-tab-full-page.png'), fullPage: true });
    console.log('Screenshot 7: Full page');

    console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}`);
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

main();
