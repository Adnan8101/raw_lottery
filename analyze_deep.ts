import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

async function deepAnalyze() {
    const templatePath = path.join(__dirname, 'assets', 'Black Minimalist Music Festival Ticket-2.png.png');
    const img = await loadImage(templatePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`Image: ${img.width}x${img.height}`);
    
    // The new template is 3500x1132
    // Right panel (beige): X=2970 to X=3499 (530px wide)
    // There's a middle section around X=1940-2960 which seems to be a perforated/torn section
    // Left side is mostly dark X=0-1080 with some elements
    
    // Let's do a fine horizontal scan to find exact panel boundaries
    console.log('\n=== FINE HORIZONTAL SCAN (every 5px) at Y=100 ===');
    let lastLabel = '';
    for (let x = 0; x < img.width; x += 5) {
        const pixel = ctx.getImageData(x, 100, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const label = brightness > 150 ? 'LIGHT' : brightness > 80 ? 'MID' : 'DARK';
        if (label !== lastLabel) {
            console.log(`  X=${x}: brightness=${brightness.toFixed(0)} rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]})`);
            lastLabel = label;
        }
    }

    // Right panel: X=2970 to 3499 → center = 3234, width = 530
    const rpLeft = 2970;
    const rpRight = 3499;
    const rpCenter = Math.floor((rpLeft + rpRight) / 2);
    const rpWidth = rpRight - rpLeft;
    
    console.log(`\nRight panel: X=${rpLeft} to X=${rpRight}, center=${rpCenter}, width=${rpWidth}`);
    
    // Find content zones on right panel vertically
    console.log('\n=== RIGHT PANEL VERTICAL CONTENT ZONES ===');
    // Check at panelCenter for brightness changes 
    let prevBright = -1;
    for (let y = 0; y < img.height; y += 2) {
        const pixel = ctx.getImageData(rpCenter, y, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (prevBright >= 0 && Math.abs(brightness - prevBright) > 20) {
            console.log(`  Y=${y}: brightness change ${prevBright.toFixed(0)} → ${brightness.toFixed(0)} rgba(${pixel[0]},${pixel[1]},${pixel[2]})`);
        }
        prevBright = brightness;
    }
    
    // Middle torn section analysis
    console.log('\n=== MIDDLE SECTION (X=1900-2970) analysis at Y=300 ===');
    for (let x = 1900; x < 2970; x += 10) {
        const pixel = ctx.getImageData(x, 300, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (x % 50 === 0 || brightness > 150) {
            console.log(`  X=${x}: brightness=${brightness.toFixed(0)} #${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`);
        }
    }
    
    // Check if right panel has existing text (Y=635-870 had content)
    // Let's do finer analysis at those content areas
    console.log('\n=== RIGHT PANEL TEXT AREAS - Fine analysis ===');
    for (let y = 600; y < 1100; y += 5) {
        let darkPixelCount = 0;
        let totalPixels = 0;
        for (let x = rpLeft + 20; x < rpRight - 20; x += 4) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
            totalPixels++;
            if (brightness < 120) darkPixelCount++;
        }
        const darkRatio = darkPixelCount / totalPixels;
        if (darkRatio > 0.05) {
            console.log(`  Y=${y}: ${(darkRatio * 100).toFixed(1)}% dark pixels (text likely here)`);
        }
    }
    
    // Check for content on TOP portion of right panel (Y=0-600)
    console.log('\n=== RIGHT PANEL TOP AREA (Y=0-600) - text detection ===');
    for (let y = 0; y < 600; y += 5) {
        let darkPixelCount = 0;
        let totalPixels = 0;
        for (let x = rpLeft + 20; x < rpRight - 20; x += 4) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
            totalPixels++;
            if (brightness < 120) darkPixelCount++;
        }
        const darkRatio = darkPixelCount / totalPixels;
        if (darkRatio > 0.03) {
            console.log(`  Y=${y}: ${(darkRatio * 100).toFixed(1)}% dark pixels`);
        }
    }
    
    // Also check if there's decorative elements - scan for non-background colors  
    console.log('\n=== RIGHT PANEL - BACKGROUND COLOR SAMPLES (every 100px Y) ===');
    for (let y = 0; y < img.height; y += 100) {
        // Sample at 10% and 90% of panel width to get bg color
        const p1 = ctx.getImageData(rpLeft + 30, y, 1, 1).data;
        const p2 = ctx.getImageData(rpRight - 30, y, 1, 1).data;
        console.log(`  Y=${y}: left-edge=rgba(${p1[0]},${p1[1]},${p1[2]}), right-edge=rgba(${p2[0]},${p2[1]},${p2[2]})`);
    }
}

deepAnalyze().catch(console.error);
