import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

async function analyzeTemplate() {
    const templatePath = path.join(__dirname, 'assets', 'Black Minimalist Music Festival Ticket-2.png.png');
    const img = await loadImage(templatePath);
    
    console.log(`\n=== NEW TEMPLATE ANALYSIS ===`);
    console.log(`Image dimensions: ${img.width} x ${img.height}`);
    console.log(`Aspect ratio: ${(img.width / img.height).toFixed(3)}`);
    
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Sample pixels across the image to find panel boundaries
    const y_mid = Math.floor(img.height / 2);
    
    console.log(`\n--- Horizontal scan at Y=${y_mid} (middle) ---`);
    let prevColor = '';
    for (let x = 0; x < img.width; x += 10) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const hex = `#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const label = brightness > 200 ? 'LIGHT' : brightness > 100 ? 'MID' : 'DARK';
        if (label !== prevColor) {
            console.log(`  X=${x}: ${hex} (${label}, brightness=${brightness.toFixed(0)})`);
            prevColor = label;
        }
    }
    
    // Scan vertically at different X positions to map regions
    const scanXPositions = [
        Math.floor(img.width * 0.1),
        Math.floor(img.width * 0.25),
        Math.floor(img.width * 0.5),
        Math.floor(img.width * 0.75),
        Math.floor(img.width * 0.85),
        Math.floor(img.width * 0.9),
        Math.floor(img.width * 0.95),
    ];
    
    for (const sx of scanXPositions) {
        console.log(`\n--- Vertical scan at X=${sx} ---`);
        let prevLabel = '';
        for (let y = 0; y < img.height; y += 10) {
            const pixel = ctx.getImageData(sx, y, 1, 1).data;
            const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
            const hex = `#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`;
            const label = brightness > 200 ? 'LIGHT' : brightness > 100 ? 'MID' : 'DARK';
            if (label !== prevLabel) {
                console.log(`  Y=${y}: ${hex} (${label}, brightness=${brightness.toFixed(0)})`);
                prevLabel = label;
            }
        }
    }
    
    // Detailed right side analysis - find the panel
    console.log(`\n--- Detailed right-side panel detection ---`);
    for (let x = Math.floor(img.width * 0.7); x < img.width; x += 5) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (brightness > 150) {
            console.log(`  Panel starts at X=${x} (brightness=${brightness.toFixed(0)}, color=#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')})`);
            break;
        }
    }
    
    // Find right edge of panel
    for (let x = img.width - 1; x > Math.floor(img.width * 0.7); x -= 5) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (brightness > 150) {
            console.log(`  Panel ends at X=${x} (brightness=${brightness.toFixed(0)})`);
            break;
        }
    }
    
    // Analyze the right panel for existing text/content areas by looking for non-uniform regions
    console.log(`\n--- Right panel content analysis (looking for text/graphics) ---`);
    const panelStartGuess = Math.floor(img.width * 0.8);
    const panelEndGuess = img.width - 10;
    const panelMidX = Math.floor((panelStartGuess + panelEndGuess) / 2);
    
    for (let y = 0; y < img.height; y += 5) {
        // Sample a horizontal strip across the panel
        let variations = 0;
        let prevBright = -1;
        for (let x = panelStartGuess; x < panelEndGuess; x += 8) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
            if (prevBright >= 0 && Math.abs(brightness - prevBright) > 30) {
                variations++;
            }
            prevBright = brightness;
        }
        if (variations > 2) {
            const pixel = ctx.getImageData(panelMidX, y, 1, 1).data;
            console.log(`  Y=${y}: Content detected (${variations} variations) center=#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`);
        }
    }

    // Also check the LEFT side for any panel/content
    console.log(`\n--- Left-side panel detection ---`);
    for (let x = 0; x < Math.floor(img.width * 0.3); x += 5) {
        const pixel = ctx.getImageData(x, y_mid, 1, 1).data;
        const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const hex = `#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`;
        if (x % 50 === 0) {
            console.log(`  X=${x}: ${hex} (brightness=${brightness.toFixed(0)})`);
        }
    }
}

analyzeTemplate().catch(console.error);
