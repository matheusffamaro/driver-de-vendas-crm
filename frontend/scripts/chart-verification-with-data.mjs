#!/usr/bin/env node
/**
 * Chart Verification with Data
 * 1. Seeds test data via API (cards + tasks)
 * 2. Logs in, captures dashboard and reports screenshots
 * 3. Attempts to hover over chart bars to capture tooltip
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../cypress/screenshots/chart-verification');
const API_URL = 'http://localhost:8000/api';

async function apiRequest(method, url, body = null, token = null) {
  const urlObj = new URL(url.startsWith('http') ? url : `${API_URL}${url}`);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? https : http;
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function seedTestData() {
  console.log('Seeding test data...');
  const { data: loginData } = await apiRequest('POST', '/auth/login', {
    email: 'admin@crm.com',
    password: 'admin123',
  });
  const token = loginData?.data?.tokens?.access_token;
  if (!token) {
    console.warn('Login failed, proceeding without seed data');
    return;
  }

  const { data: pipelinesData } = await apiRequest('GET', '/pipelines', null, token);
  const pipelines = pipelinesData?.data || [];
  const pipeline = pipelines[0];
  if (!pipeline?.id) {
    console.warn('No pipeline found');
    return;
  }

  const stages = pipeline.stages || [];
  const nonWonLostStages = stages.filter((s) => !s.is_won && !s.is_lost);
  if (nonWonLostStages.length === 0) return;

  for (let i = 0; i < nonWonLostStages.length; i++) {
    const stage = nonWonLostStages[i];
    const count = i === 0 ? 3 : i === 1 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      await apiRequest(
        'POST',
        `/pipelines/${pipeline.id}/cards`,
        { title: `Lead teste ${i}-${j}`, stage_id: stage.id },
        token
      );
    }
  }

  const wonStage = stages.find((s) => s.is_won);
  const lostStage = stages.find((s) => s.is_lost);
  if (wonStage) {
    await apiRequest(
      'POST',
      `/pipelines/${pipeline.id}/cards`,
      { title: 'Lead ganho', stage_id: wonStage.id, value: 5000 },
      token
    );
  }
  if (lostStage) {
    await apiRequest(
      'POST',
      `/pipelines/${pipeline.id}/cards`,
      { title: 'Lead perdido', stage_id: lostStage.id },
      token
    );
  }

  const statuses = ['pending', 'pending', 'in_progress', 'completed', 'completed'];
  for (let i = 0; i < statuses.length; i++) {
    await apiRequest(
      'POST',
      '/crm/tasks',
      {
        title: `Tarefa ${i + 1}`,
        status: statuses[i],
        type: 'task',
      },
      token
    );
  }
  console.log('Test data seeded.');
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await seedTestData();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3100/auth/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'admin@crm.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.waitForTimeout(2500);

    await page.goto('http://localhost:3100/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-dashboard-full.png'),
      fullPage: true,
    });
    console.log('Screenshot 1: Dashboard full page');

    await page.locator('text=Distribuição do Funil').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-dashboard-charts.png'),
      fullPage: false,
    });
    console.log('Screenshot 2: Dashboard charts section');

    const bar = page.locator('.recharts-bar-rectangle').first();
    if ((await bar.count()) > 0) {
      await bar.hover();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-dashboard-tooltip.png'),
        fullPage: false,
      });
      console.log('Screenshot 3: Tooltip on bar hover');
    } else {
      console.log('No bars to hover (data may be empty)');
    }

    await page.goto('http://localhost:3100/reports', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.locator('text=Leads por Etapa').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-reports-charts.png'),
      fullPage: true,
    });
    console.log('Screenshot 4: Reports charts');

    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'error.png'),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

main();
