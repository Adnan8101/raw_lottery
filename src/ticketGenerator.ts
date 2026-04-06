import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

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
        const preferredTemplatePath = path.join(__dirname, '..', 'Blue Modern Music Concert Ticket-2.png');
        const legacyTemplatePath = path.join(__dirname, '..', 'Blue Modern Music Concert Ticket.png');
        const fallbackTemplatePath = path.join(__dirname, '..', 'assets', 'Black Minimalist Music Festival Ticket.png');

        if (fs.existsSync(preferredTemplatePath)) {
            this.templatePath = preferredTemplatePath;
        } else if (fs.existsSync(legacyTemplatePath)) {
            this.templatePath = legacyTemplatePath;
        } else {
            this.templatePath = fallbackTemplatePath;
        }
    }

    public async generateTicket(
        userId: string,
        username: string,
        avatarUrl: string,
        ticketNumber: number,
        options: { serverName?: string; claimedAt?: Date; displayName?: string } = {}
    ): Promise<Buffer> {
        try {
            // Load the template
            if (!fs.existsSync(this.templatePath)) {
                throw new Error('Template not found. Please ensure Blue Modern Music Concert Ticket-2.png exists in the project root.');
            }

            const template = await loadImage(this.templatePath);
            const canvas = createCanvas(template.width, template.height);
            const ctx = canvas.getContext('2d');

            // Draw template as background
            ctx.drawImage(template, 0, 0, template.width, template.height);

            const width = template.width;
            const height = template.height;

            const rightStripLeftX = Math.round(width * 0.847);
            const rightStripWidth = width - rightStripLeftX;

            const pfpRadius = Math.max(54, Math.round(height * 0.078));
            const pfpCenterX = Math.round(rightStripLeftX + rightStripWidth * 0.5);
            const pfpCenterY = Math.round(height * 0.17);

            const nameSource = options.displayName?.trim() || username;
            const surname = this.extractSurname(nameSource).toUpperCase();
            const initials = this.extractSurname(username).slice(0, 1).toUpperCase() || 'U';

            const avatarImage = await this.loadAvatarImage(avatarUrl);
            this.drawCircularAvatar(ctx, avatarImage, pfpCenterX, pfpCenterY, pfpRadius, initials);

            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.font = '700 30px "Montserrat SemiBold"';
            ctx.fillText('SURNAME', pfpCenterX, pfpCenterY + pfpRadius + 48);

            this.drawFittedText(
                ctx,
                surname,
                pfpCenterX,
                pfpCenterY + pfpRadius + 98,
                pfpRadius * 2.85,
                56,
                30,
                '700',
                '"Montserrat Bold"',
                '#000000'
            );

            ctx.fillStyle = '#000000';
            ctx.font = '700 26px "Montserrat"';
            ctx.fillText(`ID ${userId}`, pfpCenterX, pfpCenterY + pfpRadius + 142);

            const ticketText = ticketNumber.toString().padStart(4, '0');
            this.drawBottomRightTicketFrame(ctx, width, height, rightStripLeftX, ticketText);

            // Return buffer directly (no file saved)
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating ticket:', error);
            throw error;
        }
    }

    private drawBottomRightTicketFrame(
        ctx: any,
        width: number,
        height: number,
        rightStripLeftX: number,
        ticketText: string
    ): void {
        const rightStripWidth = width - rightStripLeftX;
        const frameWidth = Math.round(rightStripWidth * 0.86);
        const frameHeight = Math.round(height * 0.14);
        const frameLeft = rightStripLeftX + Math.round((rightStripWidth - frameWidth) / 2);
        const frameTop = height - frameHeight - Math.round(height * 0.045);
        const frameRight = frameLeft + frameWidth;
        const frameBottom = frameTop + frameHeight;

        ctx.save();
        ctx.strokeStyle = '#06172d';
        ctx.lineWidth = Math.max(3, Math.round(width * 0.0015));
        ctx.strokeRect(frameLeft, frameTop, frameRight - frameLeft, frameBottom - frameTop);

        ctx.fillStyle = '#06172d';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 42px "Montserrat SemiBold"';
        ctx.fillText('TICKET NUMBER :', frameRight - Math.round(width * 0.008), frameTop + Math.round(frameHeight * 0.42));

        ctx.font = '800 80px "Montserrat Bold"';
        ctx.fillText(ticketText, frameRight - Math.round(width * 0.008), frameBottom - Math.round(frameHeight * 0.08));
        ctx.restore();
    }

    private async loadAvatarImage(avatarUrl: string): Promise<any | null> {
        if (!avatarUrl) {
            return null;
        }

        try {
            if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
                const response = await axios.get<ArrayBuffer>(avatarUrl, {
                    responseType: 'arraybuffer',
                    timeout: 8000
                });
                return await loadImage(Buffer.from(response.data));
            }

            if (fs.existsSync(avatarUrl)) {
                return await loadImage(avatarUrl);
            }

            return null;
        } catch {
            return null;
        }
    }

    private drawCircularAvatar(
        ctx: any,
        avatarImage: any | null,
        centerX: number,
        centerY: number,
        radius: number,
        fallbackInitial: string
    ): void {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (avatarImage) {
            ctx.drawImage(avatarImage, centerX - radius, centerY - radius, radius * 2, radius * 2);
        } else {
            // Fallback so ticket still renders when avatar fetch fails.
            ctx.fillStyle = '#1760b5';
            ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `700 ${Math.round(radius * 1.05)}px "Montserrat Bold"`;
            ctx.fillText(fallbackInitial || 'U', centerX, centerY + 2);
        }

        ctx.restore();

        ctx.strokeStyle = '#3bb4ff';
        ctx.lineWidth = Math.max(5, Math.round(radius * 0.1));
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    private extractSurname(value: string): string {
        const cleaned = value.trim().replace(/\s+/g, ' ');
        if (!cleaned) {
            return 'USER';
        }
        const parts = cleaned.split(' ');
        return parts[parts.length - 1];
    }

    private drawFittedText(
        ctx: any,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        startSize: number,
        minSize: number,
        weight: string,
        family: string,
        color: string
    ): void {
        let fontSize = startSize;
        let displayText = text;

        ctx.fillStyle = color;
        ctx.textAlign = 'center';

        while (fontSize >= minSize) {
            ctx.font = `${weight} ${fontSize}px ${family}`;
            if (ctx.measureText(displayText).width <= maxWidth) {
                ctx.fillText(displayText, x, y);
                return;
            }
            fontSize -= 1;
        }

        displayText = text;
        ctx.font = `${weight} ${minSize}px ${family}`;
        while (ctx.measureText(displayText).width > maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -1);
        }
        if (displayText !== text) {
            displayText += '…';
        }
        ctx.fillText(displayText, x, y);
    }

}
