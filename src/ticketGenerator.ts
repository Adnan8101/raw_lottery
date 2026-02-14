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
        this.templatePath = path.join(__dirname, '..', 'assets', 'Black Minimalist Music Festival Ticket.png');
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
                throw new Error('Template not found. Please ensure Black Minimalist Music Festival Ticket.png exists in assets folder.');
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
            // Template: 4000 x 1294
            // Right beige panel: X=3393 to X=3999 (606px wide)
            // Panel center X = 3696
            // Panel is fully clean beige (#dcb189) from Y=0 to Y=1293
            // Full usable height: 1293px
            // ============================================
            const panelLeft = 3393;
            const panelRight = 3999;
            const panelCenterX = Math.round((panelLeft + panelRight) / 2); // 3696
            const panelWidth = panelRight - panelLeft; // 606
            const lineWidth = Math.round(panelWidth * 0.72); // ~436px for decorative lines
            const halfLine = Math.round(lineWidth / 2);
            
            const darkColor = '#3b2c1e';       // Dark warm brown
            const accentColor = '#1a1008';      // Near-black accent
            const subtleColor = 'rgba(42, 31, 23, 0.45)'; // Semi-transparent dark
            const faintColor = 'rgba(42, 31, 23, 0.22)';  // Very subtle
            
            // ============================================
            // AVATAR - CIRCULAR, UPPER AREA OF PANEL
            // Center at Y=220, radius=140 → spans Y=80 to Y=360
            // ============================================
            const avatarCenterY = 220;
            const avatarRadius = 140;
            
            // Soft shadow behind avatar
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetY = 8;
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
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.arc(panelCenterX, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2);
            ctx.stroke();

            // ============================================
            // USERNAME - CENTERED BELOW AVATAR (Y ≈ 420)
            // ============================================
            const nameY = 420;
            
            // Truncate username if needed
            const maxNameWidth = panelWidth - 80;
            let displayName = username.toUpperCase();
            ctx.font = '46px "Montserrat Bold"';
            while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
                displayName = displayName.slice(0, -1);
            }
            if (displayName !== username.toUpperCase()) displayName += '…';
            
            // Draw username
            ctx.fillStyle = darkColor;
            ctx.font = '46px "Montserrat Bold"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(displayName, panelCenterX, nameY);

            // ============================================
            // PARTICIPANT LABEL (Y ≈ 462)
            // ============================================
            ctx.fillStyle = subtleColor;
            ctx.font = '17px "Montserrat SemiBold"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, 'PARTICIPANT', panelCenterX, nameY + 42, 8);
            
            // ============================================
            // SEPARATOR LINE (Y ≈ 510)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 510, panelCenterX + halfLine, 510, darkColor, 1.5, [12, 6]);

            // ============================================
            // TICKET NUMBER SECTION (Y ≈ 550 - 720)
            // ============================================
            const ticketNumStr = `#${ticketNumber.toString().padStart(4, '0')}`;
            
            // "TICKET NO." label
            ctx.fillStyle = subtleColor;
            ctx.font = '20px "Montserrat Medium"';
            ctx.textAlign = 'center';
            ctx.fillText('TICKET NO.', panelCenterX, 560);
            
            // Large ticket number
            ctx.fillStyle = accentColor;
            ctx.font = '86px "Montserrat Bold"';
            ctx.textAlign = 'center';
            ctx.fillText(ticketNumStr, panelCenterX, 665);
            
            // Box around ticket number
            const numWidth = ctx.measureText(ticketNumStr).width;
            const boxPad = 32;
            const boxX = panelCenterX - numWidth / 2 - boxPad;
            const boxY = 590;
            const boxW = numWidth + boxPad * 2;
            const boxH = 90;
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            
            // Corner accents
            this.drawCornerAccents(ctx, boxX, boxY, boxW, boxH, darkColor, 16, 4);

            // ============================================
            // SEPARATOR LINE (Y ≈ 740)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 740, panelCenterX + halfLine, 740, darkColor, 1.5, [12, 6]);

            // ============================================
            // CLAIM DETAILS (Y ≈ 790 - 900)
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
            ctx.font = '16px "Montserrat Medium"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, 'CLAIMED ON', panelCenterX, 790, 6);
            
            // Date & Time
            ctx.fillStyle = darkColor;
            ctx.font = '26px "Montserrat SemiBold"';
            ctx.textAlign = 'center';
            ctx.fillText(dateStr, panelCenterX, 840);
            ctx.fillText(timeStr, panelCenterX, 878);

            // ============================================
            // SEPARATOR LINE (Y ≈ 930)
            // ============================================
            this.drawDashedLine(ctx, panelCenterX - halfLine, 930, panelCenterX + halfLine, 930, darkColor, 1.5, [12, 6]);

            // ============================================
            // USER ID - VERIFICATION (Y ≈ 975)
            // ============================================
            ctx.fillStyle = faintColor;
            ctx.font = '14px "Montserrat"';
            ctx.textAlign = 'center';
            ctx.fillText(`ID: ${userId}`, panelCenterX, 975);

            // ============================================
            // LOTTERY BRANDING - BOTTOM (Y ≈ 1240)
            // ============================================
            ctx.fillStyle = faintColor;
            ctx.font = '15px "Montserrat Medium"';
            ctx.textAlign = 'center';
            this.drawSpacedText(ctx, '★ LOTTERY TICKET ★', panelCenterX, 1240, 5);

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
