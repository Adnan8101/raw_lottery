import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

// Create a professional black minimalist ticket template
const canvas = createCanvas(1200, 400);
const ctx = canvas.getContext('2d');

// Background - Black with subtle gradient
const gradient = ctx.createLinearGradient(0, 0, 1200, 400);
gradient.addColorStop(0, '#0a0a0a');
gradient.addColorStop(0.5, '#1a1a1a');
gradient.addColorStop(1, '#0a0a0a');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1200, 400);

// Gold accent bar on left
ctx.fillStyle = '#D4AF37';
ctx.fillRect(0, 0, 15, 400);

// Gold accent bar on right
ctx.fillStyle = '#D4AF37';
ctx.fillRect(1185, 0, 15, 400);

// Main border
ctx.strokeStyle = '#D4AF37';
ctx.lineWidth = 2;
ctx.strokeRect(25, 25, 1150, 350);

// Inner border
ctx.strokeStyle = '#333333';
ctx.lineWidth = 1;
ctx.strokeRect(35, 35, 1130, 330);

// Title section background
ctx.fillStyle = '#1a1a1a';
ctx.fillRect(35, 35, 1130, 90);

// Title
ctx.fillStyle = '#D4AF37';
ctx.font = 'bold 56px Arial';
ctx.textAlign = 'center';
ctx.fillText('LOTTERY TICKET', 600, 95);

// Decorative line under title
ctx.strokeStyle = '#D4AF37';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(250, 115);
ctx.lineTo(950, 115);
ctx.stroke();

// Decorative corner elements
const drawCornerDecoration = (x: number, y: number, flip: boolean) => {
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    const size = 30;
    
    if (flip) {
        // Top right and bottom left
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + size);
        ctx.stroke();
    } else {
        // Top left and bottom right
        ctx.beginPath();
        ctx.moveTo(x + size, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + size);
        ctx.stroke();
    }
};

drawCornerDecoration(50, 50, false);
drawCornerDecoration(1150, 50, true);
drawCornerDecoration(50, 350, false);
drawCornerDecoration(1150, 350, true);

// Save the template
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(assetsDir, 'Black Minimalist Music Festival Ticket.png'), buffer);

console.log('Template created successfully!');
