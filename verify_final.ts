import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

async function verify() {
    const ticketPath = path.join(__dirname, 'tickets', 'test_ticket.png');
    const imgBuffer = require('fs').readFileSync(ticketPath);
    const img = await loadImage(imgBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`Ticket: ${img.width}x${img.height}`);

    const rpLeft = 2546, rpRight = 2998;
    const rpCenter = Math.floor((rpLeft + rpRight) / 2);
    const bgColor = { r: 220, g: 177, b: 137 };

    // Find all content zones on the beige area (Y=480+)
    let zones: { start: number; end: number }[] = [];
    let inZone = false, zStart = 0;
    for (let y = 480; y < img.height; y++) {
        let hasContent = false;
        for (let x = rpLeft + 10; x < rpRight - 10; x += 3) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgColor.r) + Math.abs(p[1] - bgColor.g) + Math.abs(p[2] - bgColor.b);
            if (diff > 30) { hasContent = true; break; }
        }
        if (hasContent && !inZone) { zStart = y; inZone = true; }
        else if (!hasContent && inZone) { zones.push({ start: zStart, end: y }); inZone = false; }
    }
    if (inZone) zones.push({ start: zStart, end: img.height });

    // Merge zones within 5px gap
    const merged: typeof zones = [];
    for (const z of zones) {
        if (merged.length && z.start - merged[merged.length - 1].end < 5)
            merged[merged.length - 1].end = z.end;
        else merged.push({ ...z });
    }

    const expectedLabels = [
        'Avatar circle',
        'Username',
        'PARTICIPANT label',
        'Separator 1',
        'TICKET NO. label + number + box',
        'Separator 2',
        'CLAIMED ON + date/time',
        'Separator 3',
        'User ID',
        'Lottery branding'
    ];

    console.log(`\nFound ${merged.length} content zones (below existing image):`);
    for (let i = 0; i < merged.length; i++) {
        const z = merged[i];
        const h = z.end - z.start;
        const label = i < expectedLabels.length ? expectedLabels[i] : '???';
        
        // Find horizontal center
        let lm = rpRight, rm = rpLeft;
        for (let y = z.start; y < z.end; y += 2) {
            for (let x = rpLeft + 5; x < rpRight - 5; x += 2) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                if (Math.abs(p[0] - bgColor.r) + Math.abs(p[1] - bgColor.g) + Math.abs(p[2] - bgColor.b) > 30) {
                    lm = Math.min(lm, x); rm = Math.max(rm, x);
                }
            }
        }
        const cx = Math.floor((lm + rm) / 2);
        const off = cx - rpCenter;
        console.log(`  ${i + 1}. Y=${z.start}-${z.end} (${h}px) | X=${lm}-${rm} | centerOffset=${off > 0 ? '+' : ''}${off}px | ${label}`);
    }
    
    // Check nothing overflows panel boundaries
    console.log(`\nPanel: X=${rpLeft}-${rpRight}, center=${rpCenter}`);
    let overflow = false;
    for (const z of merged) {
        for (let y = z.start; y < z.end; y += 3) {
            // Check left overflow
            for (let x = rpLeft - 20; x < rpLeft; x += 2) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                if (Math.abs(p[0] - 1) + Math.abs(p[1] - 1) + Math.abs(p[2] - 1) > 20) {
                    // Something drawn on dark area
                }
            }
        }
    }
    if (!overflow) console.log('✅ No overflow detected outside panel');
}

verify().catch(console.error);
