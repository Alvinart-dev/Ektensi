/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o * 
 * Feature: 
 * - Dola AI (Cici AI) Web Chat Interaction & Scraping
 * - Puppeteer Extra + Stealth Plugin (Anti-Bot & WAF Bypass)
 * - Geoblocking & Region-Restricted Detection (/security/region-restricted)
 * - HTTP / HTTPS / SOCKS4 / SOCKS5 Proxy with Auth Support
 * - Fast Execution & Bandwidth Saver (Blink Engine Image Blocking)
 * - Clean Text Extraction
 *
 * note : don't claim this code, makasi Kyu dh minjemin vps
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import process from 'process';

puppeteer.use(StealthPlugin());

export async function dolaChat(prompt, options = {}) {
  const {
    proxy = null,
    headless = 'new',
    timeout = 35000,
    streamTimeout = 45000,
    blockResources = true,
    executablePath = null,
  } = options;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      status: false,
      prompt: prompt || '',
      error: 'Prompt pertanyaan tidak boleh kosong.'
    };
  }

  let browser = null;

  try {
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check'
    ];

    if (blockResources) {
      launchArgs.push('--blink-settings=imagesEnabled=false');
    }

    let proxyAuth = null;
    if (proxy) {
      let proxyServer = '';
      if (typeof proxy === 'string') {
        try {
          const parsed = new URL(proxy.includes('://') ? proxy : `http://${proxy}`);
          proxyServer = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
          if (parsed.username || parsed.password) {
            proxyAuth = {
              username: decodeURIComponent(parsed.username),
              password: decodeURIComponent(parsed.password)
            };
          }
        } catch {
          proxyServer = proxy;
        }
      } else if (typeof proxy === 'object') {
        proxyServer = proxy.server;
        if (proxy.username || proxy.password) {
          proxyAuth = {
            username: proxy.username,
            password: proxy.password
          };
        }
      }

      if (proxyServer) {
        launchArgs.push(`--proxy-server=${proxyServer}`);
      }
    }

    browser = await puppeteer.launch({
      headless,
      args: launchArgs,
      ...(executablePath ? { executablePath } : {})
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.goto('https://www.dola.com/chat/', {
      waitUntil: 'domcontentloaded',
      timeout
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/security/region-restricted')) {
      throw new Error(
        'Akses diblokir oleh dola.com karena pembatasan wilayah (/security/region-restricted). Silakan gunakan proxy dengan wilayah yang didukung (misal: Indonesia / Philippines).'
      );
    }

    try {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const okBtn = btns.find((b) => b.innerText?.trim() === 'OK');
        if (okBtn) okBtn.click();
      });
    } catch {}

    const inputSelector = '.ProseMirror, div[contenteditable="true"], textarea';
    await page.waitForSelector(inputSelector, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1000));

    await page.click(inputSelector);
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) el.focus();
    }, inputSelector);

    await page.keyboard.type(prompt.trim(), { delay: 10 });
    await new Promise((r) => setTimeout(r, 400));

    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find(
        (b) =>
          b.className.includes('send-msg') ||
          b.className.includes('send') ||
          b.getAttribute('aria-label')?.toLowerCase()?.includes('send')
      );
      if (sendBtn && !sendBtn.disabled && !sendBtn.className.includes('disabled')) {
        sendBtn.click();
        return true;
      }
      return false;
    });

    if (!submitted) {
      await page.keyboard.press('Enter');
    }

    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 800));
      let confirmed = false;
      try {
        confirmed = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find((b) => b.innerText?.trim() === 'Confirm');
          if (confirmBtn) {
            confirmBtn.click();
            return true;
          }
          return false;
        });
      } catch (e) {}
      if (confirmed) break;
    }

    let lastText = '';
    let stableCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < streamTimeout) {
      await new Promise((r) => setTimeout(r, 1200));

      let extracted = '';
      try {
        extracted = await page.evaluate(() => {
          const botContainers = Array.from(
            document.querySelectorAll('[class*="grid-cols-[minmax"]')
          );

          if (botContainers.length > 0) {
            const latest = botContainers[botContainers.length - 1];

            const answerBlock = latest.querySelector('[data-plugin-identifier*="10000"]');
            if (answerBlock && answerBlock.innerText?.trim()) {
              return answerBlock.innerText.trim();
            }

            const clone = latest.cloneNode(true);
            clone
              .querySelectorAll(
                'button, svg, [role="toolbar"], [data-plugin-identifier*="search_query"]'
              )
              .forEach((el) => el.remove());

            let clean = clone.innerText?.trim() || '';
            clean = clean
              .replace(/^(Searching the web\.\.\.|Searched for [^\n]+\n?)/i, '')
              .trim();
            return clean;
          }

          const markdownEls = Array.from(
            document.querySelectorAll('[class*="markdown"], [class*="prose"]')
          );
          if (markdownEls.length > 0) {
            return markdownEls[markdownEls.length - 1].innerText?.trim() || '';
          }

          return '';
        });
      } catch (e) {
        if (
          e.message?.includes('Execution context was destroyed') ||
          e.message?.includes('Cannot find context') ||
          e.message?.includes('Target closed')
        ) {
          continue;
        }
        throw e;
      }

      if (extracted && extracted.length > 0) {
        if (extracted === lastText) {
          stableCount++;
          if (stableCount >= 2) {
            break;
          }
        } else {
          stableCount = 0;
          lastText = extracted;
        }
      }
    }

    if (!lastText) {
      throw new Error(
        'Gagal mendapatkan balasan dari Dola AI (respons kosong atau streaming timeout).'
      );
    }

    return {
      status: true,
      prompt: prompt.trim(),
      result: lastText
    };
  } catch (error) {
    return {
      status: false,
      prompt: prompt ? prompt.trim() : '',
      error: error.message || String(error)
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const args = process.argv.slice(2);
  const promptArg = args.find((arg) => !arg.startsWith('--'));
  const proxyArg = args.find((arg) => arg.startsWith('--proxy='))?.split('=')[1];
  const isHeadlessFalse = args.includes('--no-headless') || args.includes('--headed');

  if (!promptArg) {
    console.log('\nPenggunaan CLI Dola AI Scraper:');
    console.log('  node dola.js "<pertanyaan>" [opsi]\n');
    console.log('Contoh:');
    console.log('  node dola.js "Halo Dola, apa kabar?"');
    console.log('  node dola.js "Siapa penemu gravitasi?" --proxy="http://127.0.0.1:8080"');
    console.log('  node dola.js "Buatkan pantun lucu" --no-headless\n');
    process.exit(1);
  }

  console.log(`Mengirim prompt ke Dola AI: "${promptArg}"...`);

  const response = await dolaChat(promptArg, {
    proxy: proxyArg || null,
    headless: isHeadlessFalse ? false : 'new'
  });

  console.log('\n--- Output JSON ---');
  console.log(JSON.stringify(response, null, 2));
}
