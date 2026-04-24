import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runGlobalVault() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    const outputDir = './api_vault';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    let counter = { GET: 0, POST: 0, PUT: 0 };

    console.log("🌍 GLOBAL CAPTURE ACTIVE: Monitoring ALL domains for GET/POST/PUT...");

    page.on('response', async (response) => {
        const request = response.request();
        const method = request.method();
        const url = response.url();

        // 1. NO DOMAIN FILTER: We take everything from every domain
        if (['GET', 'POST', 'PUT'].includes(method)) {
            try {
                const bodyBuffer = await response.body();
                let rawData = bodyBuffer.toString('utf8');

                // 2. CLEANING: Remove binary symbols to ensure no "red boxes"
                let previewContent;
                try {
                    previewContent = JSON.parse(rawData);
                } catch {
                    // Strips non-printable characters for raw text previews
                    previewContent = rawData.replace(/[^\x20-\x7E\x0A\x0D]/g, '');
                }

                counter[method]++;
                
                // 3. NAMING: Format filename as METHOD_DOMAIN_COUNT.json
                const domain = new URL(url).hostname.replace(/\./g, '_');
                const fileName = `${method}_${domain}_${counter[method]}.json`;
                
                const fileData = {
                    metadata: {
                        url: url,
                        method: method,
                        status: response.status(),
                        headers: response.headers()
                    },
                    payload: request.postDataJSON() || request.postData() || "No Payload",
                    preview: previewContent
                };

                fs.writeFileSync(
                    path.join(outputDir, fileName), 
                    JSON.stringify(fileData, null, 4)
                );

                console.log(`✨ Captured: [${method}] from ${domain}`);

            } catch (err) {
                // Skips empty responses or true binary (like actual .jpg/.png files)
            }
        }
    });

    // 4. Navigate and wait long enough for background activity
    await page.goto('https://instances.vantage.sh/?id=3cd35aee6b388b69b4cbde7699f5deaf385bea78', {
        waitUntil: 'networkidle',
        timeout: 90000 
    });

    // 5. THE ULTIMATE WAIT: Ensures those sneaky POST requests finish
    console.log("⏳ Keeping browser alive for 20 seconds to catch all background POST activity...");
    await page.waitForTimeout(20000);

    console.log("\n--- FINAL GLOBAL TALLY ---");
    console.log(`TOTAL -> GET: ${counter.GET} | POST: ${counter.POST} | PUT: ${counter.PUT}`);
    console.log(`All files are ready in the '${outputDir}' folder.`);
    
    await browser.close();
}

runGlobalVault();