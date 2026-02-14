import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';

async function verify() {
    const buf = fs.readFileSync('/Users/adnan/Downloads/raw_lottery/tickets/test_ticket.png');
    const img = await loadImage(buf);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`Ticket: ${img.width}x${img.height}`);

    const rpLeft = 3393, rpRight = 3999;
    const rpCenter = Math.floor((rpLeft + rpRight) / 2); // 3696
    const bgColor = { r: 220, g: 177, b: 137 };

    // Find all content zones
    const zones: { start: number; end: number }[] = [];
    let inZone = false, zStart = 0;
    for (let y = 0; y < img.height; y++) {
        let hasContent = false;
        for (let x = rpLeft + 8; x < rpRight - 8; x += 3) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p[0] - bgColor.r) + Math.abs(p[1] - bgColor.g) + Math.abs(p[2] - bgColor.b);
            if (diff > 25) { hasContent = true; break; }
        }
        if (hasContent && !inZone) { zStart = y; inZone = true; }
        else if (!hasContent && inZone) { zones.push({ start: zStart, end: y }); inZone = false; }
    }
    if (inZone) zones.push({ start: zStart, end: img.height });

    // Merge nearby zones (gap < 4px)
    const merged: typeof zones = [];
    for (const z of zones) {
        if (merged.length && z.start - merged[merged.length - 1].end < 4)
            merged[merged.length - 1].end = z.end;
        else merged.push({ ...z });
    }

    console.log(`\nFound ${merged.length} content zones on right panel:\n`);
    for (let i = 0; i < merged.length; i++) {
        const z = merged[i];
        const h = z.end - z.start;

        // Find horizontal extent
        let lm = rpRight, rm = rpLeft;
        for (let y = z.start; y < z.end; y += 2) {
            for (let x = rpLeft + 4; x < rpRight - 4; x += 2) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                if (Math.abs(p[0] - bgColor.r) + Math.abs(p[1] - bgColor.g) + Math.abs(p[2] - bgColor.b) > 25) {
                    lm = Math.min(lm, x); rm = Math.max(rm, x);
                }
            }
        }
        const cx = Math.floor((lm + rm) / 2);
        const off = cx - rpCenter;
        const w = rm - lm;

        console.log(`  ${String(i + 1).padStart(2)}. Y=${String(z.start).padStart(4)}-${String(z.end).padStart(4)} (${String(h).padStart(3)}px tall) | X=${lm}-${rm} (${String(w).padStart(3)}px wide) | center offset: ${off >= 0 ? '+' : ''}${off}px`);
    }

    // Check if anything overflows panel
    let overflowCount = 0;
    for (const z of merged) {
        for (let y = z.start; y < z.end; y += 2) {
            for (let x = rpLeft - 30; x < rpLeft; x += 2) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                const b = (p[0] + p[1] + p[2]) / 3;
                if (b > 10 && b < 170) overflowCount++; // not pure black, not beige
            }
        }
    }
    console.log(overflowCount > 0 ? `\n⚠️  ${overflowCount} overflow pixels detected` : '\n✅ No overflow - all content within panel bounds');
}

verify().catch(console.error);
