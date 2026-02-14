import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Register custom fonts
const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
if (fs.existsSync(fontsDir)) {
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-Bold.ttf'), 'Montserrat Bold');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-SemiBold.ttf'), 'Montserrat SemiBold');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-Medium.ttf'), 'Montserrat Medium');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat-Regular.ttf'), 'Montserrat');
}

export class TicketGenerator {
    private templatePath: string;

    constructor() {
        this.templatePath = path.join(__dirname, '..', 'assets', 'Black Minimalist Music Festival Ticket-2.png.png');
    }

    private async downloadImage(url: string): Promise<Buffer> {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data);
        } catch (error) {
            console.error('Error downloading image:', error);
            throw error;
        }
    }

    public async generateTicket(
        userId: string,
        username: string,
        avatarUrl: string,
        ticketNumber: number
    ): Promise<Buffer> {
        try {
            // Load the template
            if (!fs.existsSync(this.templatePath)) {
                throw new Error('Template not found. Please ensure Black Minimalist Music Festival Ticket-2.png.png exists in assets folder.');
            }

            const template = await loadImage(this.templatePath);
            const canvas = createCanvas(template.width, template.height);
            const ctx = canvas.getContext('2d');
            
            // Draw template as background
            ctx.drawImage(template, 0, 0, template.width, template.height);
            
            // Download and draw user avatar
            const avatarBuffer = await this.downloadImage(avatarUrl);
            const avatar = await loadImage(avatarBuffer);
            
            // ============================================
            // LAYOUT CONSTANTS
            // Template: 3000 x 971
            // Right beige panel: X=2545 to X=2999 (454px wide)
            // Panel center X = 2772, full height 0-970
            // ============================================
            const panelLeft = 2545;
            const panelRight = 2999;
            const panelCenterX = Math.round((panelLeft + panelRight) / 2); // 2772
            const panelWidth = panelRight - panelLeft; // 454
            const lineWidth = Math.round(panelWidth * 0.75); // ~340px for decorative lines
            const halfLine = Math.round(lineWidth / 2);
            
            const darkColor = '#3b2c1e';       // Dark warm brown
            const accentColor = '#1a1008';      // Near-black accent
            const subtleColor = 'rgba(42, 31, 23, 0.45)'; // Semi-transparent dark
            const faintColor = 'rgba(42, 31, 23, 0.22)';  // Very subtle
            
            // ============================================
            // AVATAR - CIRCULAR, UPPER AREA OF PANEL
            // Center at Y=170, radius=120 → spans Y=50 to Y=290
            // ============================================
            const avatarCenterY = 170;
            const avatarRadius = 120;
            
            // Soft shadow behind avatar
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 25;
            ctx.shadowOffsetY = 6;
            ctx.beginPath();
            ctx.arc(panelCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.restore();
            
            // Draw avatar clipped to circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(panelCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
                avatar,
                panelCenterX - avatarRadius,
                avatarCenterY - avatarRadius,
                avatarRadius * 2,
                avatarRadius * 2
            );
            ctx.restore();

            // Avatar border ring
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(panelCenterX, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2);
            ctx.stroke();

            // ============================================
            // USERNAME - CENTERED BELOW AVATAR (Y ≈ 330)
            // ============================================
            const nameY = 335;
            
            // Truncate username if needed
            const maxNameWidth = panelWidth - 80; // 374px max
            let displayName = username.toUpperCase();
            ctx.font = '38px "Montserrat Bold"';
            while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
                displayName = displayName.slice(0, -1);
            }
            if (displayName !== username.toUpperCase()) displayName += '…';
            
            // Draw username
            ctx.fillStyle = darkColor;
            ctx.font = '38px "Montserrat Bold"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(displayName, panelCenterX, nameY);

            // ============================================
            // PARTICIPANT LABEL (Y ≈ 370)
            // ============================================
            ctx.fillStyle = subtleColor;
            ctx.font = '15px "Montserrat SemiBold"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, 'PARTICIPANT', panelCenterX, nameY + 35, 8);
            
            // ============================================
            // SEPARATOR LINE (Y ≈ 415)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 415, panelCenterX + halfLine, 415, darkColor, 1, [10, 5]);

            // ============================================
            // TICKET NUMBER SECTION (Y ≈ 445 - 580)
            // ============================================
            const ticketNumStr = `#${ticketNumber.toString().padStart(4, '0')}`;
            
            // "TICKET NO." label
            ctx.fillStyle = subtleColor;
            ctx.font = '18px "Montserrat Medium"';
            ctx.textAlign = 'center';
            ctx.fillText('TICKET NO.', panelCenterX, 452);
            
            // Large ticket number
            ctx.fillStyle = accentColor;
            ctx.font = '72px "Montserrat Bold"';
            ctx.textAlign = 'center';
            ctx.fillText(ticketNumStr, panelCenterX, 530);
            
            // Box around ticket number
            const numWidth = ctx.measureText(ticketNumStr).width;
            const boxPad = 28;
            const boxX = panelCenterX - numWidth / 2 - boxPad;
            const boxY = 470;
            const boxW = numWidth + boxPad * 2;
            const boxH = 75;
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            
            // Corner accents
            this.drawCornerAccents(ctx, boxX, boxY, boxW, boxH, darkColor, 14, 3.5);

            // ============================================
            // SEPARATOR LINE (Y ≈ 600)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 600, panelCenterX + halfLine, 600, darkColor, 1, [10, 5]);

            // ============================================
            // CLAIM DETAILS (Y ≈ 630 - 720)
            // ============================================
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            }).toUpperCase();
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', minute: '2-digit', hour12: true 
            }).toUpperCase();
            
            // "CLAIMED ON" label
            ctx.fillStyle = subtleColor;
            ctx.font = '14px "Montserrat Medium"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, 'CLAIMED ON', panelCenterX, 640, 5);
            
            // Date & Time
            ctx.fillStyle = darkColor;
            ctx.font = '22px "Montserrat SemiBold"';
            ctx.textAlign = 'center';
            ctx.fillText(dateStr, panelCenterX, 678);
            ctx.fillText(timeStr, panelCenterX, 710);

            // ============================================
            // SEPARATOR LINE (Y ≈ 740)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 745, panelCenterX + halfLine, 745, darkColor, 1, [10, 5]);

            // ============================================
            // USER ID - VERIFICATION (Y ≈ 780)
            // ============================================
            ctx.fillStyle = faintColor;
            ctx.font = '12px "Montserrat"';
            ctx.textAlign = 'center';
            ctx.fillText(`ID: ${userId}`, panelCenterX, 780);

            // ============================================
            // LOTTERY BRANDING - BOTTOM (Y ≈ 920)
            // ============================================
            ctx.fillStyle = faintColor;
            ctx.font = '13px "Montserrat Medium"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, '★ LOTTERY TICKET ★', panelCenterX, 930, 4);

            // Return buffer directly (no file saved)
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating ticket:', error);
            throw error;
        }
    }

    /** Draw text with manual letter spacing (since canvas doesn't natively support it well) */
    private drawSpacedText(ctx: any, text: string, x: number, y: number, spacing: number): void {
        const chars = text.split('');
        const totalWidth = chars.reduce((w, c) => w + ctx.measureText(c).width + spacing, -spacing);
        let curX = x - totalWidth / 2;
        for (const char of chars) {
            const charW = ctx.measureText(char).width;
            ctx.fillText(char, curX + charW / 2, y);
            curX += charW + spacing;
        }
    }

    /** Draw a dashed line between two points */
    private drawDashedLine(ctx: any, x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash: number[]): void {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** Draw corner accent brackets on a rectangle */
    private drawCornerAccents(ctx: any, x: number, y: number, w: number, h: number, color: string, len: number, lineW: number): void {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        const o = 2; // offset outside box
        // Top-left
        ctx.beginPath(); ctx.moveTo(x - o, y + len); ctx.lineTo(x - o, y - o); ctx.lineTo(x + len, y - o); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(x + w - len, y - o); ctx.lineTo(x + w + o, y - o); ctx.lineTo(x + w + o, y + len); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(x - o, y + h - len); ctx.lineTo(x - o, y + h + o); ctx.lineTo(x + len, y + h + o); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(x + w - len, y + h + o); ctx.lineTo(x + w + o, y + h + o); ctx.lineTo(x + w + o, y + h - len); ctx.stroke();
    }

}
