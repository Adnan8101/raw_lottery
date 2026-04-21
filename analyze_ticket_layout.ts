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

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

async function analyzeTicketLayout() {
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

    // Divider detection: strongest brightness drop in the right half.
    let dividerX = Math.floor(width * 0.79);
    let bestDrop = -1;

    for (let x = Math.floor(width * 0.70); x < Math.floor(width * 0.88); x++) {
        let currentAvg = 0;
        let nextAvg = 0;
        let rows = 0;

        for (let y = 0; y < height; y += 2) {
            currentAvg += brightness(getPixel(ctx, x, y));
            nextAvg += brightness(getPixel(ctx, clamp(x + 1, 0, width - 1), y));
            rows += 1;
        }

        currentAvg /= rows;
        nextAvg /= rows;

        const drop = currentAvg - nextAvg;
        if (drop > bestDrop) {
            bestDrop = drop;
            dividerX = x;
        }
    }

    const panel = {
        left: clamp(dividerX + 20, 0, width - 1),
        top: Math.round(height * 0.077),
        width: Math.round(width * 0.172),
        height: Math.round(height * 0.845)
    };

    const pfpRadius = Math.max(52, Math.round(Math.min(panel.width * 0.23, panel.height * 0.18)));
    const pfpCenterX = Math.round(panel.left + panel.width * 0.5);
    const pfpCenterY = Math.round(panel.top + pfpRadius + panel.height * 0.08);

    const usernameY = pfpCenterY + pfpRadius + Math.round(panel.height * 0.10);
    const separatorY = Math.round(usernameY + panel.height * 0.035);

    const ticketBox = {
        width: Math.round(panel.width * 0.80),
        height: Math.round(panel.height * 0.11)
    };
    ticketBox.width = clamp(ticketBox.width, 0, panel.width);
    ticketBox.height = clamp(ticketBox.height, 0, panel.height);

    const ticketBoxLeft = panel.left + Math.round((panel.width - ticketBox.width) / 2);
    const ticketBoxTop = Math.round(separatorY + panel.height * 0.045);

    const metaStartY = ticketBoxTop + ticketBox.height + Math.round(panel.height * 0.045);

    console.log('=== BROWN TICKET LAYOUT ANALYSIS ===');
    console.log(`Template: ${templateName}`);
    console.log(`Size: ${width} x ${height}`);
    console.log('');
    console.log('Detected structure:');
    console.log(`- Divider X: ${dividerX}`);
    console.log(`- Right panel: left=${panel.left}, top=${panel.top}, width=${panel.width}, height=${panel.height}`);
    console.log('');
    console.log('Suggested anchors:');
    console.log(`- PFP center: x=${pfpCenterX}, y=${pfpCenterY}, radius=${pfpRadius}`);
    console.log(`- Username baseline y=${usernameY}`);
    console.log(`- Separator y=${separatorY}`);
    console.log(`- Ticket box: left=${ticketBoxLeft}, top=${ticketBoxTop}, width=${ticketBox.width}, height=${ticketBox.height}`);
    console.log(`- Meta text start y=${metaStartY}`);
}

analyzeTicketLayout().catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
});
