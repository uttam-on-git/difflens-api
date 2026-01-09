import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';

// change these urls
const url1 = 'https://www.google.com';
const url2 = 'https://www.bing.com';

const VIEWPORT = { width: 1280, height: 720 };

// crops image to target size
function cropToSize(png, targetWidth, targetHeight) {
  const cropped = new PNG({ width: targetWidth, height: targetHeight });

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcIdx = (png.width * y + x) << 2;
      const dstIdx = (targetWidth * y + x) << 2;

      cropped.data[dstIdx] = png.data[srcIdx];
      cropped.data[dstIdx + 1] = png.data[srcIdx + 1];
      cropped.data[dstIdx + 2] = png.data[srcIdx + 2];
      cropped.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return cropped;
}

async function captureScreenshot(page, url, outputPath) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`Captured: ${outputPath}`);
}

async function run() {
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await captureScreenshot(page, url1, 'screenshot1.png');
    await captureScreenshot(page, url2, 'screenshot2.png');

    const img1 = PNG.sync.read(fs.readFileSync('screenshot1.png'));
    const img2 = PNG.sync.read(fs.readFileSync('screenshot2.png'));

    console.log(`Image 1: ${img1.width}x${img1.height}`);
    console.log(`Image 2: ${img2.width}x${img2.height}`);

    // use smaller dimensions so pixelmatch doesnt crash
    const targetWidth = Math.min(img1.width, img2.width);
    const targetHeight = Math.min(img1.height, img2.height);

    console.log(`Normalized: ${targetWidth}x${targetHeight}`);

    const normalized1 = cropToSize(img1, targetWidth, targetHeight);
    const normalized2 = cropToSize(img2, targetWidth, targetHeight);

    const diff = new PNG({ width: targetWidth, height: targetHeight });

    const mismatchedPixels = pixelmatch(
      normalized1.data,
      normalized2.data,
      diff.data,
      targetWidth,
      targetHeight,
      { threshold: 0.1 }
    );

    const totalPixels = targetWidth * targetHeight;
    const mismatchPercentage = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

    fs.writeFileSync('diff.png', PNG.sync.write(diff));
    console.log('Saved: diff.png');

    console.log('----------------------------------');
    console.log(`Mismatched pixels: ${mismatchedPixels}`);
    console.log(`Mismatch: ${mismatchPercentage}%`);
    console.log('----------------------------------');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Done.');
    }
  }
}

run();
