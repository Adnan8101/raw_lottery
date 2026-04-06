import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
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
        _userId: string,
        username: string,
        avatarUrl: string,
        ticketNumber: number,
        _options: { serverName?: string; claimedAt?: Date; displayName?: string } = {}
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

            const pfpRadius = Math.max(64, Math.round(height * 0.092));
            const pfpCenterX = Math.round(rightStripLeftX + rightStripWidth * 0.5);
            const pfpCenterY = Math.round(height * 0.19);

            const initials = (username.trim().charAt(0) || 'U').toUpperCase();

            const avatarImage = await this.loadAvatarImage(avatarUrl);
            this.drawCircularAvatar(ctx, avatarImage, pfpCenterX, pfpCenterY, pfpRadius, initials);

            this.drawFittedUsername(
                ctx,
                username,
                pfpCenterX,
                pfpCenterY + pfpRadius + 114,
                pfpRadius * 3
            );

            const ticketFrameHeight = Math.round(height * 0.165);
            const ticketFrameTop = height - ticketFrameHeight - Math.round(height * 0.045);
            const usernameY = pfpCenterY + pfpRadius + 114;
            const pricePanelWidth = Math.round(rightStripWidth * 0.9);
            const pricePanelHeight = Math.round(height * 0.09);
            const pricePanelLeft = pfpCenterX - Math.round(pricePanelWidth / 2);
            const minPricePanelTop = usernameY + Math.round(height * 0.045);
            const preferredPricePanelTop = ticketFrameTop - pricePanelHeight - Math.round(height * 0.07);
            const pricePanelTop = Math.max(minPricePanelTop, preferredPricePanelTop);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fillRect(pricePanelLeft, pricePanelTop, pricePanelWidth, pricePanelHeight);
            ctx.strokeStyle = '#06172d';
            ctx.lineWidth = Math.max(4, Math.round(width * 0.0019));
            ctx.strokeRect(pricePanelLeft, pricePanelTop, pricePanelWidth, pricePanelHeight);

            ctx.fillStyle = '#06172d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 38px "Montserrat Bold"';
            ctx.fillText('PRICE POOL : ₹1000', pfpCenterX, pricePanelTop + Math.round(pricePanelHeight * 0.52));

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
        const frameWidth = Math.round(rightStripWidth * 0.9);
        const frameHeight = Math.round(height * 0.165);
        const frameLeft = rightStripLeftX + Math.round((rightStripWidth - frameWidth) / 2);
        const frameTop = height - frameHeight - Math.round(height * 0.045);
        const frameRight = frameLeft + frameWidth;
        const frameBottom = frameTop + frameHeight;

        ctx.save();
        ctx.strokeStyle = '#06172d';
        ctx.lineWidth = Math.max(5, Math.round(width * 0.0023));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.fillRect(frameLeft, frameTop, frameRight - frameLeft, frameBottom - frameTop);
        ctx.strokeRect(frameLeft, frameTop, frameRight - frameLeft, frameBottom - frameTop);

        ctx.fillStyle = '#06172d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = Math.max(4, Math.round(width * 0.003));
        ctx.font = '800 34px "Montserrat Bold"';
        ctx.fillText('TICKET NUMBER :', frameLeft + Math.round(frameWidth * 0.5), frameTop + Math.round(frameHeight * 0.34));

        ctx.font = '900 76px "Montserrat Bold"';
        ctx.fillText(ticketText, frameLeft + Math.round(frameWidth * 0.5), frameTop + Math.round(frameHeight * 0.77));
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

    private drawFittedUsername(
        ctx: any,
        username: string,
        centerX: number,
        baselineY: number,
        maxWidth: number
    ): void {
        const rawUsername = username.trim() || 'User';

        let usernameCore = rawUsername;
        let displayUsername = usernameCore;
        let usernameSize = 40;

        const minUsernameSize = 22;

        const measureWidth = (nameText: string): number => {
            ctx.font = `800 ${usernameSize}px "Montserrat Bold"`;
            return ctx.measureText(nameText).width;
        };

        let measuredWidth = measureWidth(displayUsername);

        while (measuredWidth > maxWidth && usernameSize > minUsernameSize) {
            usernameSize -= 1;
            measuredWidth = measureWidth(displayUsername);
        }

        while (measuredWidth > maxWidth && usernameCore.length > 3) {
            usernameCore = usernameCore.slice(0, -1);
            displayUsername = `${usernameCore}…`;
            measuredWidth = measureWidth(displayUsername);
        }

        const startX = centerX - measuredWidth / 2;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = '#000000';
        ctx.font = `800 ${usernameSize}px "Montserrat Bold"`;
        ctx.fillText(displayUsername, startX, baselineY);
    }

}
