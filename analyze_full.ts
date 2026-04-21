/// <reference types="node" />

import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

type RGB = { r: number; g: number; b: number };

function getPixel(ctx: any, x: number, y: number): RGB {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
}

function brightness(p: RGB): number {
    return (p.r + p.g + p.b) / 3;
}

function colorDiff(a: RGB, b: RGB): number {
    return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function avgColumnBrightness(ctx: any, x: number, height: number): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < height; y += 2) {
        total += brightness(getPixel(ctx, x, y));
        count += 1;
    }
    return total / Math.max(1, count);
}

async function analyzeFull() {
    const templateName = 'Brown_Modern_Midnight_Party_Ticket_20260420_204013_0000.png';
    const templatePath = path.join(__dirname, templateName);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
    }

    const img = await loadImage(fs.readFileSync(templatePath));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const width = img.width;
    const height = img.height;

    let dividerX = Math.floor(width * 0.79);
    let strongestDrop = -1;

    for (let x = Math.floor(width * 0.70); x < Math.floor(width * 0.88); x++) {
        const b1 = avgColumnBrightness(ctx, x, height);
        const b2 = avgColumnBrightness(ctx, x + 1, height);
        const drop = b1 - b2;
        if (drop > strongestDrop) {
            strongestDrop = drop;
            dividerX = x;
        }
    }

    const rightPanel = {
        left: dividerX + 20,
        top: Math.round(height * 0.077),
        width: Math.round(width * 0.172),
        height: Math.round(height * 0.845)
    };

    const samplePoints = [
        { x: rightPanel.left + 20, y: rightPanel.top + 30 },
        { x: rightPanel.left + Math.round(rightPanel.width * 0.5), y: rightPanel.top + Math.round(rightPanel.height * 0.2) },
        { x: rightPanel.left + Math.round(rightPanel.width * 0.5), y: rightPanel.top + Math.round(rightPanel.height * 0.6) },
        { x: rightPanel.left + rightPanel.width - 20, y: rightPanel.top + rightPanel.height - 30 }
    ];

    const panelBase = getPixel(ctx, rightPanel.left + 20, rightPanel.top + 20);

    let nonBasePixels = 0;
    let scannedPixels = 0;
    for (let y = rightPanel.top; y < rightPanel.top + rightPanel.height; y += 2) {
        for (let x = rightPanel.left; x < rightPanel.left + rightPanel.width; x += 2) {
            const p = getPixel(ctx, x, y);
            if (colorDiff(p, panelBase) > 25) {
                nonBasePixels += 1;
            }
            scannedPixels += 1;
        }
    }

    console.log('========================================');
    console.log('BROWN TICKET FULL ANALYSIS');
    console.log('========================================');
    console.log(`Template: ${templateName}`);
    console.log(`Dimensions: ${width} x ${height}`);
    console.log('');
    console.log('Right side detection:');
    console.log(`- Divider x: ${dividerX}`);
    console.log(`- Brightness drop score: ${strongestDrop.toFixed(2)}`);
    console.log(`- Panel rect: left=${rightPanel.left}, top=${rightPanel.top}, width=${rightPanel.width}, height=${rightPanel.height}`);
    console.log('');
    console.log('Panel color and texture:');
    console.log(`- Base color: rgb(${panelBase.r}, ${panelBase.g}, ${panelBase.b})`);
    console.log(`- Non-base pixel ratio: ${((nonBasePixels / Math.max(1, scannedPixels)) * 100).toFixed(2)}%`);
    console.log('');
    console.log('Sample points inside panel:');
    for (const point of samplePoints) {
        const p = getPixel(ctx, point.x, point.y);
        console.log(`- (${point.x}, ${point.y}) => rgb(${p.r}, ${p.g}, ${p.b})`);
    }
    console.log('');
    console.log('Recommended drawing palette:');
    console.log('- Primary text: #FFFFFF');
    console.log('- Secondary text: rgba(255,255,255,0.92)');
    console.log('- Divider: rgba(255,255,255,0.24)');
    console.log('- Ticket box border: rgba(255,255,255,0.38)');
    console.log('- Ticket box fill: rgba(255,255,255,0.08)');
    console.log('========================================');
}

analyzeFull().catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
});
