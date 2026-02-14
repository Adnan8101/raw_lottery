import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';

async function checkOverflow() {
    // Compare original template vs generated ticket to see if WE drew outside the panel
    const origBuf = fs.readFileSync('/Users/adnan/Downloads/raw_lottery/assets/Black Minimalist Music Festival Ticket.png');
    const tickBuf = fs.readFileSync('/Users/adnan/Downloads/raw_lottery/tickets/test_ticket.png');
    
    const origImg = await loadImage(origBuf);
    const tickImg = await loadImage(tickBuf);
    
    const c1 = createCanvas(origImg.width, origImg.height);
    const c2 = createCanvas(tickImg.width, tickImg.height);
    const ctx1 = c1.getContext('2d');
    const ctx2 = c2.getContext('2d');
    ctx1.drawImage(origImg, 0, 0);
    ctx2.drawImage(tickImg, 0, 0);
    
    // Check area left of panel (X=3360-3393) for any differences (= our drawing bleeding out)
    let diffCount = 0;
    for (let y = 0; y < origImg.height; y += 2) {
        for (let x = 3360; x < 3393; x += 2) {
            const p1 = ctx1.getImageData(x, y, 1, 1).data;
            const p2 = ctx2.getImageData(x, y, 1, 1).data;
            const diff = Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) + Math.abs(p1[2] - p2[2]);
            if (diff > 5) diffCount++;
        }
    }
    
    console.log(`Pixels changed outside panel (X=3360-3393): ${diffCount}`);
    console.log(diffCount === 0 ? '✅ No overflow - our drawing stays within the panel' : `⚠️  ${diffCount} pixels leaked outside`);
}

checkOverflow().catch(console.error);
