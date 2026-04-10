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
    private templateImage: any | null = null;

    constructor() {
        const preferredTemplatePath = path.join(__dirname, '..', 'Grey_Black_Purple_Minimalist_Music_Night_Event_Ticket_20260410_195437_0000.png');
        const legacyTemplatePath = path.join(__dirname, '..', 'Blue Modern Music Concert Ticket-2.png');
        const olderLegacyTemplatePath = path.join(__dirname, '..', 'Blue Modern Music Concert Ticket.png');
        const fallbackTemplatePath = path.join(__dirname, '..', 'assets', 'Black Minimalist Music Festival Ticket.png');

        if (fs.existsSync(preferredTemplatePath)) {
            this.templatePath = preferredTemplatePath;
        } else if (fs.existsSync(legacyTemplatePath)) {
            this.templatePath = legacyTemplatePath;
        } else if (fs.existsSync(olderLegacyTemplatePath)) {
            this.templatePath = olderLegacyTemplatePath;
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
                throw new Error('Template not found. Please ensure a ticket template PNG exists in the project root.');
            }

            const template = await this.getTemplateImage();
            const canvas = createCanvas(template.width, template.height);
            const ctx = canvas.getContext('2d');

            // Draw template as background
            ctx.drawImage(template, 0, 0, template.width, template.height);

            const width = template.width;
            const height = template.height;

            const profilePanel = this.getRightProfilePanel(width, height);

            const pfpRadius = Math.max(72, Math.round(Math.min(profilePanel.width * 0.27, profilePanel.height * 0.18)));
            const pfpCenterX = Math.round(profilePanel.left + profilePanel.width * 0.5);
            const pfpCenterY = Math.round(profilePanel.top + pfpRadius + profilePanel.height * 0.06);

            const initials = (username.trim().charAt(0) || 'U').toUpperCase();

            const avatarImage = await this.loadAvatarImage(avatarUrl);
            this.drawCircularAvatar(ctx, avatarImage, pfpCenterX, pfpCenterY, pfpRadius, initials);

            const usernameY = pfpCenterY + pfpRadius + Math.round(profilePanel.height * 0.11);

            this.drawFittedUsername(
                ctx,
                username,
                pfpCenterX,
                usernameY,
                Math.round(profilePanel.width * 0.82)
            );

            const separatorY = this.drawUsernameSeparator(ctx, profilePanel, usernameY);

            const ticketText = ticketNumber.toString().padStart(4, '0');
            this.drawTicketNumberPanel(ctx, profilePanel, ticketText, separatorY);

            // Return buffer directly (no file saved)
            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating ticket:', error);
            throw error;
        }
    }

    private getRightProfilePanel(
        width: number,
        height: number
    ): { left: number; top: number; width: number; height: number } {
        // Coordinates tuned to the current music-night template right rounded rectangle.
        const left = Math.round(width * 0.822);
        const top = Math.round(height * 0.145);
        const panelWidth = Math.round(width * 0.148);
        const panelHeight = Math.round(height * 0.75);

        return {
            left,
            top,
            width: panelWidth,
            height: panelHeight
        };
    }

    private async getTemplateImage(): Promise<any> {
        if (!this.templateImage) {
            this.templateImage = await loadImage(this.templatePath);
        }

        return this.templateImage;
    }

    private drawTicketNumberPanel(
        ctx: any,
        panel: { left: number; top: number; width: number; height: number },
        ticketText: string,
        separatorY: number
    ): void {
        const numberBoxWidth = Math.round(panel.width * 0.80);
        const numberBoxHeight = Math.round(panel.height * 0.095);
        const numberBoxLeft = panel.left + Math.round((panel.width - numberBoxWidth) / 2);
        const baseBoxTop = Math.round(separatorY + panel.height * 0.045);
        const maxBottom = panel.top + panel.height - Math.round(panel.height * 0.05);
        const overflow = Math.max(0, baseBoxTop + numberBoxHeight - maxBottom);
        const numberBoxTop = baseBoxTop - overflow;
        const centerX = numberBoxLeft + Math.round(numberBoxWidth * 0.5);
        const centerY = numberBoxTop + Math.round(numberBoxHeight * 0.54);
        const ticketLabel = `Ticket : #${ticketText}`;

        let fontSize = 24;
        const minFontSize = 16;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textFits = (size: number): boolean => {
            ctx.font = `700 ${size}px "Montserrat SemiBold"`;
            return ctx.measureText(ticketLabel).width <= numberBoxWidth * 0.88;
        };

        while (!textFits(fontSize) && fontSize > minFontSize) {
            fontSize -= 1;
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.45)';
        ctx.lineWidth = 2;
        ctx.fillRect(numberBoxLeft, numberBoxTop, numberBoxWidth, numberBoxHeight);
        ctx.strokeRect(numberBoxLeft, numberBoxTop, numberBoxWidth, numberBoxHeight);

        ctx.fillStyle = '#14161a';
        ctx.font = `700 ${fontSize}px "Montserrat SemiBold"`;
        ctx.fillText(ticketLabel, centerX, centerY);
        ctx.restore();
    }

    private drawUsernameSeparator(
        ctx: any,
        panel: { left: number; top: number; width: number; height: number },
        usernameY: number
    ): number {
        const separatorY = Math.round(usernameY + panel.height * 0.035);
        const centerX = panel.left + Math.round(panel.width * 0.5);

        ctx.save();
        ctx.strokeStyle = 'rgba(32, 34, 37, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - Math.round(panel.width * 0.24), separatorY);
        ctx.lineTo(centerX + Math.round(panel.width * 0.24), separatorY);
        ctx.stroke();
        ctx.restore();

        return separatorY;
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

        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = Math.max(4, Math.round(radius * 0.075));
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
        let usernameSize = 38;

        const minUsernameSize = 24;

        const measureWidth = (nameText: string): number => {
            ctx.font = `700 ${usernameSize}px "Montserrat SemiBold"`;
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

        ctx.fillStyle = '#111827';
        ctx.font = `700 ${usernameSize}px "Montserrat SemiBold"`;
        ctx.fillText(displayUsername, startX, baselineY);
    }

}
