#!/usr/bin/env node
/**
 * Chart Components Verification Script
 * Logs in, captures dashboard and reports page screenshots to verify chart rendering.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../cypress/screenshots/chart-verification');

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // 1. Login
    await page.goto('http://localhost:3100/auth/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'admin@crm.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for charts to load

    // 2. Dashboard - scroll to charts (Distribuição do Funil, Status das Tarefas)
    await page.locator('text=Distribuição do Funil').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-dashboard-charts.png'),
      fullPage: true,
    });
    console.log('Screenshot 1: Dashboard charts');

    // 3. Navigate to reports
    await page.goto('http://localhost:3100/reports', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for report data and charts

    // 4. Reports - scroll to charts (Leads por Etapa, Resultado do Funil, Desempenho de Tarefas)
    await page.locator('text=Leads por Etapa').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-reports-charts.png'),
      fullPage: true,
    });
    console.log('Screenshot 2: Reports charts');

    // 5. Full reports page
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-reports-full.png'),
      fullPage: true,
    });
    console.log('Screenshot 3: Reports full page');

    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'error.png'),
      fullPage: true,
    });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

main();
