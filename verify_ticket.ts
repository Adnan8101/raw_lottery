import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

async function verifyTicket() {
    const ticketPath = path.join(__dirname, 'tickets', 'test_ticket.png');
    const img = await loadImage(ticketPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log(`Generated ticket: ${img.width}x${img.height}`);

    // Check right panel (X=2970-3499) for drawn content
    const rpLeft = 2970;
    const rpRight = 3499;
    const rpCenter = Math.floor((rpLeft + rpRight) / 2);
    const bgColor = { r: 220, g: 177, b: 137 }; // Expected beige background

    console.log('\n=== CONTENT DETECTION ON RIGHT PANEL ===');
    let contentZones: { start: number; end: number }[] = [];
    let inContent = false;
    let contentStart = 0;

    for (let y = 0; y < img.height; y += 3) {
        let hasContent = false;
        for (let x = rpLeft + 15; x < rpRight - 15; x += 6) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const diffR = Math.abs(pixel[0] - bgColor.r);
            const diffG = Math.abs(pixel[1] - bgColor.g);
            const diffB = Math.abs(pixel[2] - bgColor.b);
            if (diffR + diffG + diffB > 40) {
                hasContent = true;
                break;
            }
        }
        if (hasContent && !inContent) {
            contentStart = y;
            inContent = true;
        } else if (!hasContent && inContent) {
            contentZones.push({ start: contentStart, end: y });
            inContent = false;
        }
    }
    if (inContent) contentZones.push({ start: contentStart, end: img.height });

    // Merge nearby zones (within 10px gap)
    const merged: typeof contentZones = [];
    for (const zone of contentZones) {
        if (merged.length > 0 && zone.start - merged[merged.length - 1].end < 10) {
            merged[merged.length - 1].end = zone.end;
        } else {
            merged.push({ ...zone });
        }
    }

    console.log(`\nFound ${merged.length} content zones:`);
    const labels = ['Avatar (circle)', 'Username text', 'Participant label', 'Separator 1', 'Ticket No label', 'Ticket number + box', 'Separator 2', 'Claimed On label', 'Date/Time', 'Separator 3', 'User ID', 'Lottery branding'];
    
    for (let i = 0; i < merged.length; i++) {
        const z = merged[i];
        const height = z.end - z.start;
        const centerY = Math.floor((z.start + z.end) / 2);
        
        // Check horizontal extent of content
        let leftMost = rpRight;
        let rightMost = rpLeft;
        for (let y = z.start; y < z.end; y += 3) {
            for (let x = rpLeft + 5; x < rpRight - 5; x += 3) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const diff = Math.abs(pixel[0] - bgColor.r) + Math.abs(pixel[1] - bgColor.g) + Math.abs(pixel[2] - bgColor.b);
                if (diff > 40) {
                    leftMost = Math.min(leftMost, x);
                    rightMost = Math.max(rightMost, x);
                }
            }
        }
        const contentWidth = rightMost - leftMost;
        const contentCenterX = Math.floor((leftMost + rightMost) / 2);
        const offsetFromCenter = contentCenterX - rpCenter;
        
        console.log(`  Zone ${i + 1}: Y=${z.start}-${z.end} (${height}px tall) | X=${leftMost}-${rightMost} (${contentWidth}px wide) | Center offset: ${offsetFromCenter > 0 ? '+' : ''}${offsetFromCenter}px`);
    }
    
    // Check panel margins
    console.log(`\nPanel center: X=${rpCenter}`);
    console.log(`Panel bounds: X=${rpLeft} to X=${rpRight}`);
}

verifyTicket().catch(console.error);
