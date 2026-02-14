import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';

async function fullAnalysis() {
    // Load the correct image
    const templatePath = '/Users/adnan/Downloads/raw_lottery/Black Minimalist Music Festival Ticket.png';
    const buf = fs.readFileSync(templatePath);
    const img = await loadImage(buf);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`\n========================================`);
    console.log(`IMAGE: Black Minimalist Music Festival Ticket.png`);
    console.log(`Dimensions: ${img.width} x ${img.height}`);
    console.log(`========================================`);

    const y_mid = Math.floor(img.height / 2);

    // =============================================
    // 1. FIND RIGHT PANEL BOUNDARIES (precise)
    // =============================================
    console.log(`\n=== 1. RIGHT PANEL BOUNDARIES ===`);
    
    // Scan at multiple Y positions to get consistent panel edges
    const scanYs = [50, Math.floor(img.height * 0.25), y_mid, Math.floor(img.height * 0.75), img.height - 50];
    for (const sy of scanYs) {
        for (let x = Math.floor(img.width * 0.5); x < img.width; x++) {
            ctx.getImageData(x, sy, 1, 1).data;
        }
        // Find the LAST continuous block of bright pixels (the right panel)
        let lastBrightStart = -1, lastBrightEnd = -1;
        let inBright = false;
        for (let x = Math.floor(img.width * 0.5); x < img.width; x++) {
            const p = ctx.getImageData(x, sy, 1, 1).data;
            const b = (p[0] + p[1] + p[2]) / 3;
            if (b > 160 && !inBright) { lastBrightStart = x; inBright = true; }
            if (b > 160) lastBrightEnd = x;
            if (b <= 160 && inBright) inBright = false;
        }
        console.log(`  Y=${sy}: last bright block X=${lastBrightStart} to X=${lastBrightEnd} (${lastBrightEnd - lastBrightStart}px)`);
    }

    // Use Y at bottom half (below any image) for clean panel detection
    const cleanY = Math.floor(img.height * 0.85);
    let panelLeft = -1, panelRight = -1;
    let inBlock = false;
    for (let x = Math.floor(img.width * 0.5); x < img.width; x++) {
        const p = ctx.getImageData(x, cleanY, 1, 1).data;
        const b = (p[0] + p[1] + p[2]) / 3;
        if (b > 160 && !inBlock) { panelLeft = x; inBlock = true; }
        if (b > 160) panelRight = x;
        if (b <= 160 && inBlock) inBlock = false;
    }
    const panelCenterX = Math.floor((panelLeft + panelRight) / 2);
    const panelWidth = panelRight - panelLeft;
    console.log(`\n  >>> PANEL: X=${panelLeft} to X=${panelRight}`);
    console.log(`  >>> Width: ${panelWidth}px, Center: X=${panelCenterX}`);

    // Get background color
    const bgP = ctx.getImageData(panelCenterX, cleanY, 1, 1).data;
    console.log(`  >>> Background: rgba(${bgP[0]},${bgP[1]},${bgP[2]})`);

    // =============================================
    // 2. FIND EXISTING CONTENT ON PANEL (image/text baked in)
    // =============================================
    console.log(`\n=== 2. EXISTING CONTENT ON PANEL ===`);
    console.log(`  Scanning for non-background pixels...`);
    
    let contentTop = -1, contentBottom = -1;
    for (let y = 0; y < img.height; y++) {
        let nonBg = 0, total = 0;
        for (let x = panelLeft + 5; x < panelRight - 5; x += 2) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgP[0]) + Math.abs(p[1] - bgP[1]) + Math.abs(p[2] - bgP[2]);
            total++;
            if (diff > 40) nonBg++;
        }
        const ratio = nonBg / total;
        if (ratio > 0.1) {
            if (contentTop === -1) contentTop = y;
            contentBottom = y;
        }
    }
    
    if (contentTop >= 0) {
        console.log(`  >>> Existing content: Y=${contentTop} to Y=${contentBottom} (${contentBottom - contentTop}px)`);
    } else {
        console.log(`  >>> No existing content found - panel is clean`);
    }

    // More detailed - find content zones
    console.log(`\n  Detailed content zones:`);
    let zones: {start: number, end: number, maxRatio: number}[] = [];
    let inZone = false, zStart = 0, maxR = 0;
    for (let y = 0; y < img.height; y++) {
        let nonBg = 0, total = 0;
        for (let x = panelLeft + 5; x < panelRight - 5; x += 2) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgP[0]) + Math.abs(p[1] - bgP[1]) + Math.abs(p[2] - bgP[2]);
            total++;
            if (diff > 40) nonBg++;
        }
        const ratio = nonBg / total;
        if (ratio > 0.05 && !inZone) { zStart = y; inZone = true; maxR = ratio; }
        if (ratio > 0.05 && inZone) { maxR = Math.max(maxR, ratio); }
        if (ratio <= 0.05 && inZone) { zones.push({start: zStart, end: y, maxRatio: maxR}); inZone = false; }
    }
    if (inZone) zones.push({start: zStart, end: img.height, maxRatio: maxR});
    
    // Merge zones within 15px gap
    const merged: typeof zones = [];
    for (const z of zones) {
        if (merged.length && z.start - merged[merged.length - 1].end < 15) {
            merged[merged.length - 1].end = z.end;
            merged[merged.length - 1].maxRatio = Math.max(merged[merged.length - 1].maxRatio, z.maxRatio);
        } else {
            merged.push({...z});
        }
    }
    
    for (const z of merged) {
        const height = z.end - z.start;
        const label = z.maxRatio > 0.5 ? 'LARGE IMAGE/GRAPHIC' : z.maxRatio > 0.2 ? 'TEXT/ELEMENT' : 'SUBTLE';
        console.log(`    Y=${z.start}-${z.end} (${height}px) | peak: ${(z.maxRatio * 100).toFixed(0)}% | ${label}`);
    }

    // =============================================
    // 3. FIND USABLE (CLEAN) AREA
    // =============================================
    console.log(`\n=== 3. USABLE CLEAN AREA ===`);
    let cleanStart = 0;
    // Find first Y where panel is clean (all beige) - scanning from top
    for (let y = 0; y < img.height; y++) {
        let nonBg = 0, total = 0;
        for (let x = panelLeft + 10; x < panelRight - 10; x += 2) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgP[0]) + Math.abs(p[1] - bgP[1]) + Math.abs(p[2] - bgP[2]);
            total++;
            if (diff > 30) nonBg++;
        }
        if (nonBg / total < 0.02 && y > (contentBottom || 0)) {
            cleanStart = y;
            break;
        }
    }
    
    // Find last clean Y from bottom
    let cleanEnd = img.height;
    for (let y = img.height - 1; y > 0; y--) {
        let nonBg = 0, total = 0;
        for (let x = panelLeft + 10; x < panelRight - 10; x += 2) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgP[0]) + Math.abs(p[1] - bgP[1]) + Math.abs(p[2] - bgP[2]);
            total++;
            if (diff > 30) nonBg++;
        }
        if (nonBg / total < 0.02) {
            cleanEnd = y;
            break;
        }
    }
    
    console.log(`  >>> Clean beige area: Y=${cleanStart} to Y=${cleanEnd}`);
    console.log(`  >>> Usable height: ${cleanEnd - cleanStart}px`);

    // =============================================
    // 4. VERTICAL PROFILE AT PANEL CENTER
    // =============================================
    console.log(`\n=== 4. VERTICAL PROFILE AT PANEL CENTER (X=${panelCenterX}) ===`);
    let prevBright = -1;
    for (let y = 0; y < img.height; y += 2) {
        const p = ctx.getImageData(panelCenterX, y, 1, 1).data;
        const b = (p[0] + p[1] + p[2]) / 3;
        if (prevBright >= 0 && Math.abs(b - prevBright) > 15) {
            console.log(`  Y=${y}: brightness ${prevBright.toFixed(0)} → ${b.toFixed(0)} rgba(${p[0]},${p[1]},${p[2]})`);
        }
        prevBright = b;
    }

    // =============================================
    // 5. BACKGROUND COLOR AT EVERY 25px IN CLEAN AREA
    // =============================================
    console.log(`\n=== 5. BACKGROUND SAMPLES IN CLEAN AREA ===`);
    for (let y = cleanStart; y <= cleanEnd; y += 25) {
        const pL = ctx.getImageData(panelLeft + 15, y, 1, 1).data;
        const pC = ctx.getImageData(panelCenterX, y, 1, 1).data;
        const pR = ctx.getImageData(panelRight - 15, y, 1, 1).data;
        console.log(`  Y=${y}: left=(${pL[0]},${pL[1]},${pL[2]}) center=(${pC[0]},${pC[1]},${pC[2]}) right=(${pR[0]},${pR[1]},${pR[2]})`);
    }
    
    // =============================================
    // 6. SUMMARY
    // =============================================
    console.log(`\n========================================`);
    console.log(`SUMMARY:`);
    console.log(`  Image: ${img.width} x ${img.height}`);
    console.log(`  Right panel: X=${panelLeft} to X=${panelRight} (${panelWidth}px wide)`);
    console.log(`  Panel center X: ${panelCenterX}`);
    console.log(`  Background color: rgba(${bgP[0]},${bgP[1]},${bgP[2]})`);
    if (contentTop >= 0) {
        console.log(`  Existing content: Y=${contentTop} to Y=${contentBottom}`);
    }
    console.log(`  Usable clean area: Y=${cleanStart} to Y=${cleanEnd} (${cleanEnd - cleanStart}px)`);
    console.log(`========================================`);
}

fullAnalysis().catch(console.error);
