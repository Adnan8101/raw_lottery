import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

async function analyzeTemplate() {
    const templatePath = path.join(__dirname, 'assets', 'Black Minimalist Music Festival Ticket.png');
    const img = await loadImage(templatePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`\n=== TEMPLATE ANALYSIS ===`);
    console.log(`Image dimensions: ${img.width} x ${img.height}`);
    console.log(`Aspect ratio: ${(img.width / img.height).toFixed(3)}`);

    const y_mid = Math.floor(img.height / 2);

    // Fine horizontal scan to find panel boundaries
    console.log(`\n--- Horizontal scan at Y=${y_mid} ---`);
    let lastLabel = '';
    for (let x = 0; x < img.width; x += 5) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const label = brightness > 150 ? 'LIGHT' : brightness > 80 ? 'MID' : 'DARK';
        if (label !== lastLabel) {
            console.log(`  X=${x}: brightness=${brightness.toFixed(0)} rgba(${pixel[0]},${pixel[1]},${pixel[2]})`);
            lastLabel = label;
        }
    }

    // Find exact right panel boundaries
    console.log(`\n--- Right panel boundary detection ---`);
    let panelStart = -1, panelEnd = -1;
    for (let x = Math.floor(img.width * 0.6); x < img.width; x += 2) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (brightness > 150 && panelStart === -1) {
            panelStart = x;
        }
        if (brightness > 150) {
            panelEnd = x;
        }
    }
    console.log(`  Panel: X=${panelStart} to X=${panelEnd} (${panelEnd - panelStart}px wide)`);
    console.log(`  Panel center: X=${Math.floor((panelStart + panelEnd) / 2)}`);

    // Check for existing text/content on the panel
    console.log(`\n--- Right panel content scan (text detection) ---`);
    const bgColor = ctx.getImageData(panelEnd - 20, 50, 1, 1).data;
    console.log(`  Background color: rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]})`);

    for (let y = 0; y < img.height; y += 3) {
        let darkCount = 0, total = 0;
        for (let x = panelStart + 10; x < panelEnd - 10; x += 4) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(pixel[0] - bgColor[0]) + Math.abs(pixel[1] - bgColor[1]) + Math.abs(pixel[2] - bgColor[2]);
            total++;
            if (diff > 50) darkCount++;
        }
        const ratio = darkCount / total;
        if (ratio > 0.03) {
            console.log(`  Y=${y}: ${(ratio * 100).toFixed(1)}% non-bg pixels`);
        }
    }

    // Vertical scan at panel center for color changes
    const pcx = Math.floor((panelStart + panelEnd) / 2);
    console.log(`\n--- Vertical scan at panel center X=${pcx} ---`);
    let prevBright = -1;
    for (let y = 0; y < img.height; y += 2) {
        const pixel = ctx.getImageData(pcx, y, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (prevBright >= 0 && Math.abs(brightness - prevBright) > 20) {
            console.log(`  Y=${y}: brightness ${prevBright.toFixed(0)} → ${brightness.toFixed(0)} rgba(${pixel[0]},${pixel[1]},${pixel[2]})`);
        }
        prevBright = brightness;
    }

    // Panel background samples at different heights
    console.log(`\n--- Panel background uniformity check ---`);
    for (let y = 0; y < img.height; y += 50) {
        const p = ctx.getImageData(pcx, y, 1, 1).data;
        console.log(`  Y=${y}: rgba(${p[0]},${p[1]},${p[2]})`);
    }
}

analyzeTemplate().catch(console.error);
