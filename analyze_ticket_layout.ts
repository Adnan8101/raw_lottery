/// <reference types="node" />

import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

type Pixel = { r: number; g: number; b: number; a: number };

function brightness(p: Pixel): number {
    return (p.r + p.g + p.b) / 3;
}

function getPixel(ctx: any, x: number, y: number): Pixel {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

function colorDiff(a: Pixel, b: Pixel): number {
    return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function strongestDarkColumn(ctx: any, height: number, fromX: number, toX: number): { x: number; score: number } {
    let bestX = fromX;
    let bestScore = -1;

    for (let x = fromX; x <= toX; x++) {
        let darkCount = 0;
        for (let y = 0; y < height; y += 2) {
            const p = getPixel(ctx, x, y);
            if (brightness(p) < 35) {
                darkCount++;
            }
        }

        if (darkCount > bestScore) {
            bestScore = darkCount;
            bestX = x;
        }
    }

    return { x: bestX, score: bestScore };
}

function nonBgBounds(
    ctx: any,
    width: number,
    height: number,
    bg: Pixel,
    fromX: number,
    toX: number,
    threshold: number
): { minX: number; maxX: number; minY: number; maxY: number; count: number } {
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let count = 0;

    for (let y = 0; y < height; y++) {
        for (let x = fromX; x <= toX; x++) {
            const p = getPixel(ctx, x, y);
            if (colorDiff(p, bg) > threshold) {
                count++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    return { minX, maxX, minY, maxY, count };
}

async function analyzeTicketLayout() {
    const templatePath = path.join(__dirname, 'Blue Modern Music Concert Ticket.png');

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
    }

    const img = await loadImage(fs.readFileSync(templatePath));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const width = img.width;
    const height = img.height;

    const leftDivider = strongestDarkColumn(ctx, height, 0, Math.floor(width * 0.45));
    const rightSectionStart = strongestDarkColumn(ctx, height, Math.floor(width * 0.75), Math.floor(width * 0.9));
    const ticketLabelRail = strongestDarkColumn(ctx, height, Math.floor(width * 0.9), width - 1);

    const rightBg = getPixel(ctx, width - 30, 30);
    const rightStripBounds = nonBgBounds(ctx, width, height, rightBg, rightSectionStart.x, width - 1, 70);

    console.log('=== IMAGE METRICS ===');
    console.log(`Template: ${templatePath}`);
    console.log(`Dimensions: ${width}x${height}`);

    console.log('\n=== STRUCTURE DETECTION ===');
    console.log(`Left divider strongest dark column: X=${leftDivider.x} (score=${leftDivider.score})`);
    console.log(`Right section start strongest dark column: X=${rightSectionStart.x} (score=${rightSectionStart.score})`);
    console.log(`Ticket label rail strongest dark column: X=${ticketLabelRail.x} (score=${ticketLabelRail.score})`);

    console.log('\n=== RIGHT STRIP CONTENT ===');
    console.log(`Right strip non-background bounds: X=${rightStripBounds.minX}-${rightStripBounds.maxX}, Y=${rightStripBounds.minY}-${rightStripBounds.maxY}`);
    console.log(`Detected non-bg pixels in right strip: ${rightStripBounds.count}`);

    const suggestedLeftCenterX = Math.round(leftDivider.x * 0.5);
    const suggestedTicketValueX = Math.min(width - 42, ticketLabelRail.x + 72);
    const suggestedTicketValueY = Math.round(height * 0.71);

    console.log('\n=== SUGGESTED DRAW ANCHORS ===');
    console.log(`Left section center X: ${suggestedLeftCenterX}`);
    console.log(`Server icon Y: ${Math.round(height * 0.14)}`);
    console.log(`User icon Y: ${Math.round(height * 0.50)}`);
    console.log(`Claimed text Y: ${Math.round(height * 0.76)}-${Math.round(height * 0.82)}`);
    console.log(`Ticket number (vertical) anchor: X=${suggestedTicketValueX}, Y=${suggestedTicketValueY}`);
}

analyzeTicketLayout().catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
});
