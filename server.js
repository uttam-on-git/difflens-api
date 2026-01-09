import express from 'express';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

async function captureScreenshot(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  return await page.screenshot({ fullPage: true });
}

app.post('/compare', async (req, res) => {
  const { url1, url2, threshold = 0.1 } = req.body;

  if (!url1 || !url2) {
    return res.status(400).json({ error: 'Missing url1 or url2' });
  }

  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    const buffer1 = await captureScreenshot(page, url1);
    const buffer2 = await captureScreenshot(page, url2);

    const img1 = PNG.sync.read(buffer1);
    const img2 = PNG.sync.read(buffer2);

    // use smaller dimensions so pixelmatch doesnt crash
    const targetWidth = Math.min(img1.width, img2.width);
    const targetHeight = Math.min(img1.height, img2.height);

    const normalized1 = cropToSize(img1, targetWidth, targetHeight);
    const normalized2 = cropToSize(img2, targetWidth, targetHeight);

    const diff = new PNG({ width: targetWidth, height: targetHeight });

    const mismatchedPixels = pixelmatch(
      normalized1.data,
      normalized2.data,
      diff.data,
      targetWidth,
      targetHeight,
      { threshold }
    );

    const totalPixels = targetWidth * targetHeight;
    const mismatchPercentage = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

    const screenshot1Base64 = buffer1.toString('base64');
    const screenshot2Base64 = buffer2.toString('base64');
    const diffBase64 = PNG.sync.write(diff).toString('base64');

    res.json({
      success: true,
      data: {
        mismatchPercentage: parseFloat(mismatchPercentage),
        mismatchedPixels,
        totalPixels,
        dimensions: {
          image1: { width: img1.width, height: img1.height },
          image2: { width: img2.width, height: img2.height },
          normalized: { width: targetWidth, height: targetHeight }
        },
        images: {
          screenshot1: `data:image/png;base64,${screenshot1Base64}`,
          screenshot2: `data:image/png;base64,${screenshot2Base64}`,
          diff: `data:image/png;base64,${diffBase64}`
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
