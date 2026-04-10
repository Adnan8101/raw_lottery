import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType, Message, TextChannel, Guild, AttachmentBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, Options } from 'discord.js';
import dotenv from 'dotenv';
import { Database } from './database';
import { Participant, Winner, LotteryConfig } from './models';
import { TicketGenerator } from './ticketGenerator';
dotenv.config();

// Queue item interface
interface QueueItem {
    message: Message;
    resolve: () => void;
}

class LotteryBot {
    private client: Client;
    private ticketGenerator: TicketGenerator;
    private database: Database;
    private readonly ownerUserId: string = '929297205796417597';
    private readonly maxTicketQueueSize: number = 500;
    
    // Queue system to prevent duplicate tickets
    private ticketQueue: QueueItem[] = [];
    private isProcessingQueue: boolean = false;
    
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ],
            makeCache: Options.cacheWithLimits({
                MessageManager: 200
            }),
            sweepers: {
                messages: {
                    interval: 300,
                    lifetime: 600
                }
            }
        });
        this.ticketGenerator = new TicketGenerator();
        this.database = Database.getInstance();
        this.setupEventHandlers();
    }
    private setupEventHandlers(): void {
        this.client.once('ready', async () => {
            console.log(`Logged in as ${this.client.user?.tag}`);
            await this.database.connect();
            await this.initializeConfig();
        });
        this.client.on('messageCreate', (message) => this.handleMessage(message));
    }
    private async initializeConfig(): Promise<void> {
        const config = await LotteryConfig.findOne();
        if (!config) {
            await LotteryConfig.create({
                isActive: false,
                claimChannel: null,
                logChannel: null,
                ticketCounter: 1
            });
        }
    }

    private async getConfig(): Promise<any> {
        return await LotteryConfig.findOne().lean();
    }

    private isAdmin(message: Message): boolean {
        if (message.author.id === this.ownerUserId) {
            return true;
        }

        return message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    }

    // Add ticket claim to queue and wait for processing
    private async addToTicketQueue(message: Message): Promise<void> {
        return new Promise((resolve) => {
            this.ticketQueue.push({ message, resolve });
            this.processTicketQueue();
        });
    }

    // Process ticket queue one by one
    private async processTicketQueue(): Promise<void> {
        if (this.isProcessingQueue || this.ticketQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        try {
            while (this.ticketQueue.length > 0) {
                const item = this.ticketQueue.shift();
                if (item) {
                    try {
                        await this.processTicketClaim(item.message);
                    } catch (error) {
                        console.error('Error processing ticket claim:', error);
                    }
                    item.resolve();
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private async sendLog(guild: Guild, content: string | { embeds: EmbedBuilder[], files?: AttachmentBuilder[] }): Promise<void> {
        const config = await this.getConfig();
        if (!config?.logChannel) return;

        try {
            const logChannel = await guild.channels.fetch(config.logChannel) as TextChannel;
            if (logChannel) {
                if (typeof content === 'string') {
                    await logChannel.send(content);
                } else {
                    await logChannel.send(content);
                }
            }
        } catch (error) {
            console.error('Error sending log:', error);
        }
    }

    private async handleSetupLottery(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        if (!message.guild) return;

        // Create channel select menu for claim channel (with search)
        const claimSelect = new ChannelSelectMenuBuilder()
            .setCustomId('claim_channel_select')
            .setPlaceholder('Search and select Claim Channel')
            .setChannelTypes(ChannelType.GuildText)
            .setMinValues(1)
            .setMaxValues(1);

        const claimRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(claimSelect);

        const setupEmbed = new EmbedBuilder()
            .setTitle('Lottery Setup - Step 1/2')
            .setDescription('Please select the **Claim Channel** where users can claim tickets\n\nUse the dropdown below to search and select')
            .setColor(0x5865F2)
            .setFooter({ text: 'You can search for channels by typing' })
            .setTimestamp();

        const reply = await message.reply({
            embeds: [setupEmbed],
            components: [claimRow]
        });

        // Wait for claim channel selection
        try {
            const claimInteraction = await reply.awaitMessageComponent({
                filter: i => i.user.id === message.author.id && i.customId === 'claim_channel_select',
                componentType: ComponentType.ChannelSelect,
                time: 60000
            });

            const claimChannelId = claimInteraction.channels.first()?.id;
            if (!claimChannelId) {
                await claimInteraction.update({ content: 'Invalid channel selection.', embeds: [], components: [] });
                return;
            }
            
            await LotteryConfig.updateOne({}, { claimChannel: claimChannelId });

            // Create channel select menu for log channel (with search)
            const logSelect = new ChannelSelectMenuBuilder()
                .setCustomId('log_channel_select')
                .setPlaceholder('Search and select Log Channel')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1);

            const logRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
                .addComponents(logSelect);

            const logEmbed = new EmbedBuilder()
                .setTitle('Lottery Setup - Step 2/2')
                .setDescription(`Claim Channel: <#${claimChannelId}>\n\nNow select the **Log Channel** for lottery logs\n\nUse the dropdown below to search and select`)
                .setColor(0x5865F2)
                .setFooter({ text: 'You can search for channels by typing' })
                .setTimestamp();

            await claimInteraction.update({
                embeds: [logEmbed],
                components: [logRow]
            });

            // Wait for log channel selection
            const logInteraction = await reply.awaitMessageComponent({
                filter: i => i.user.id === message.author.id && i.customId === 'log_channel_select',
                componentType: ComponentType.ChannelSelect,
                time: 60000
            });

            const logChannelId = logInteraction.channels.first()?.id;
            if (!logChannelId) {
                await logInteraction.update({ content: 'Invalid channel selection.', embeds: [], components: [] });
                return;
            }
            await LotteryConfig.updateOne({}, { logChannel: logChannelId });

            const successEmbed = new EmbedBuilder()
                .setTitle('Lottery Setup Complete')
                .addFields(
                    { name: 'Claim Channel', value: `<#${claimChannelId}>`, inline: true },
                    { name: 'Log Channel', value: `<#${logChannelId}>`, inline: true }
                )
                .setDescription('Use `!setlottery` to start the lottery')
                .setColor(0x57F287)
                .setTimestamp();

            await logInteraction.update({
                embeds: [successEmbed],
                components: []
            });

            if (message.guild) {
                await this.sendLog(message.guild, { embeds: [successEmbed] });
            }

        } catch (error) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Setup Timeout')
                .setDescription('Setup timed out. Please run `!setup-lottery` again.')
                .setColor(0xED4245)
                .setTimestamp();

            await reply.edit({
                embeds: [timeoutEmbed],
                components: []
            });
        }
    }

    private async handleSetLottery(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        const config = await this.getConfig();
        if (!config?.claimChannel) {
            await message.reply('Please run `!setup-lottery` first.');
            return;
        }

        await LotteryConfig.updateOne({}, {
            isActive: true,
            ticketCounter: 1
        });
        
        await Participant.deleteMany({});
        await Winner.deleteMany({});

        const startEmbed = new EmbedBuilder()
            .setTitle('Lottery Started')
            .setDescription(`The lottery is now active. Users can claim tickets in <#${config.claimChannel}>`)
            .addFields({ name: 'Claim Tickets', value: 'Type `!lottery` to get your ticket', inline: false })
            .setTimestamp();

        await message.reply({ embeds: [startEmbed] });
        if (message.guild) {
            await this.sendLog(message.guild, { embeds: [startEmbed] });
        }
    }

    private async handleClaimTicket(message: Message): Promise<void> {
        const config = await this.getConfig();

        if (!config?.isActive) {
            await message.reply('The lottery is not currently active.');
            return;
        }

        if (!config.claimChannel) {
            await message.reply('Lottery is not properly set up.');
            return;
        }

        if (message.channel.id !== config.claimChannel) {
            await message.reply(`Please claim tickets in <#${config.claimChannel}>`);
            return;
        }

        // Check if already claimed BEFORE adding to queue
        const existingParticipant = await Participant.exists({ userId: message.author.id });
        if (existingParticipant) {
            await message.reply('you have already claimed your ticket');
            return;
        }

        // Test if user has DMs enabled BEFORE adding to queue
        try {
            await message.author.send('Verifying DM access...');
        } catch (dmError) {
            await message.reply(`<@${message.author.id}> Your DMs are off. Please enable DMs and type \`!lottery\` again to claim your ticket.`);
            return;
        }

        if (this.ticketQueue.length >= this.maxTicketQueueSize) {
            await message.reply('Ticket queue is currently full. Please try again in a few seconds.');
            return;
        }

        // Add to queue for sequential processing
        await this.addToTicketQueue(message);
    }

    // Process ticket claim - called from queue (one at a time)
    private async processTicketClaim(message: Message): Promise<void> {
        try {
            // Double-check if already claimed (in case user spammed)
            const existingParticipant = await Participant.exists({ userId: message.author.id });
            if (existingParticipant) {
                await message.reply('you have already claimed your ticket');
                return;
            }

            // Get FRESH config for accurate ticket counter
            const config = await LotteryConfig.findOne().select({ ticketCounter: 1 }).lean();
            if (!config) {
                await message.reply('Lottery is not configured.');
                return;
            }

            const ticketNumber = config.ticketCounter;
            const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 256 });
            const claimedAt = new Date();

            // Generate ticket image (returns Buffer, not saved to disk)
            const ticketBuffer = await this.ticketGenerator.generateTicket(
                message.author.id,
                message.author.username,
                avatarUrl,
                ticketNumber,
                {
                    serverName: message.guild?.name,
                    claimedAt,
                    displayName: message.member?.displayName ?? message.author.globalName ?? message.author.username
                }
            );

            // Save participant to database (no file path stored)
            await Participant.create({
                userId: message.author.id,
                username: message.author.username,
                ticketNumber: ticketNumber,
                claimedAt,
                avatarUrl: avatarUrl
            });

            // Increment counter IMMEDIATELY after creating participant
            await LotteryConfig.updateOne({}, { $inc: { ticketCounter: 1 } });

            const totalParticipants = await Participant.countDocuments();

            // Send single-line confirmation in channel
            await message.reply(`ticket #${ticketNumber} sent in your dms`);

            // Send ticket to user's DM (plain image + text, no embed)
            const dmAttachment = new AttachmentBuilder(ticketBuffer, { name: 'ticket.png' });
            const dateStr = claimedAt.toLocaleDateString('en-US', {
                timeZone: 'Asia/Kolkata',
                month: 'short', day: 'numeric', year: 'numeric' 
            });
            const timeStr = claimedAt.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit', minute: '2-digit', hour12: true 
            });

            await message.author.send({
                content: `Ticket ID: #${ticketNumber}\nUsername: ${message.author.username}\nClaimed: ${dateStr} at ${timeStr}`,
                files: [dmAttachment]
            });

            // Send to logs
            if (message.guild) {
                const logAttachment = new AttachmentBuilder(ticketBuffer, { name: 'ticket.png' });
                const logEmbed = new EmbedBuilder()
                    .setTitle('New Ticket Claimed')
                    .setDescription(`User: ${message.author.tag}`)
                    .addFields(
                        { name: 'User', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Ticket Number', value: `**#${ticketNumber}**`, inline: true },
                        { name: 'Total Participants', value: `${totalParticipants}`, inline: true }
                    )
                    .setThumbnail(avatarUrl)
                    .setImage('attachment://ticket.png')
                    .setTimestamp();

                await this.sendLog(message.guild, { embeds: [logEmbed], files: [logAttachment] });
            }

        } catch (error) {
            console.error('Error generating ticket:', error);
            await message.reply('An error occurred while generating your ticket. Please try again.');
        }
    }

    private async handleEndLottery(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        const config = await this.getConfig();
        if (!config?.isActive) {
            await message.reply('The lottery is not currently active.');
            return;
        }

        await LotteryConfig.updateOne({}, { isActive: false });
        const totalParticipants = await Participant.countDocuments();

        const endEmbed = new EmbedBuilder()
            .setTitle('Lottery Ended')
            .setDescription('The lottery has been closed. No more tickets can be claimed.')
            .addFields({ name: 'Total Participants', value: `${totalParticipants}`, inline: true })
            .setFooter({ text: 'Use !lotterywinner to pick winners' })
            .setTimestamp();

        await message.reply({ embeds: [endEmbed] });
        if (message.guild) {
            await this.sendLog(message.guild, { embeds: [endEmbed] });
        }
    }

    private async handlePickWinner(message: Message, place: number): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        if (isNaN(place) || place < 1) {
            await message.reply('Usage: `!lotterywinner <place>` (e.g., `!lotterywinner 1`)');
            return;
        }

        const totalParticipants = await Participant.countDocuments();
        if (totalParticipants === 0) {
            await message.reply('No participants in the lottery.');
            return;
        }

        // Check if this place is already taken
        const existingWinner = await Winner.findOne({ position: place }).select({ userId: 1, _id: 0 }).lean();
        if (existingWinner) {
            await message.reply(`Position #${place} already has a winner: <@${existingWinner.userId}>. Use \`!reroll ${place}\` to reroll.`);
            return;
        }

        // Exclude all previous winners from being picked again
        const winnerUserIds = (await Winner.find().select({ userId: 1, _id: 0 }).lean()).map(w => w.userId);
        const availableParticipants = await Participant.find({
            userId: { $nin: winnerUserIds }
        }).select({ userId: 1, username: 1, ticketNumber: 1, avatarUrl: 1, _id: 0 }).lean();

        if (availableParticipants.length === 0) {
            await message.reply('All participants have already won.');
            return;
        }

        const winner = availableParticipants[Math.floor(Math.random() * availableParticipants.length)];

        await Winner.create({
            userId: winner.userId,
            username: winner.username,
            ticketNumber: winner.ticketNumber,
            position: place,
            wonAt: new Date(),
            avatarUrl: winner.avatarUrl
        });

        const ordinal = this.getOrdinal(place);
        const winnerEmbed = new EmbedBuilder()
            .setTitle(`${ordinal} Place Winner`)
            .setDescription(`Congratulations to the ${ordinal} place winner!`)
            .addFields(
                { name: 'Winner', value: `<@${winner.userId}>`, inline: true },
                { name: 'Ticket Number', value: `**#${winner.ticketNumber}**`, inline: true },
                { name: 'Position', value: `**${ordinal} Place**`, inline: true }
            )
            .setThumbnail(winner.avatarUrl)
            .setTimestamp();

        await message.reply({ embeds: [winnerEmbed] });
        if (message.guild) {
            await this.sendLog(message.guild, { embeds: [winnerEmbed] });
        }
    }

    private getOrdinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    private async handleReroll(message: Message, position: number): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        if (isNaN(position) || position < 1) {
            await message.reply('Usage: `!reroll <place>` (e.g., `!reroll 1`)');
            return;
        }

        const oldWinner = await Winner.findOne({ position: position }).select({ userId: 1, ticketNumber: 1, _id: 0 }).lean();
        
        if (!oldWinner) {
            await message.reply(`No winner found at position #${position}`);
            return;
        }

        // Remove old winner from winners list
        await Winner.deleteOne({ position: position });

        // Exclude all remaining winners from being picked
        const winnerUserIds = (await Winner.find().select({ userId: 1, _id: 0 }).lean()).map(w => w.userId);
        const availableParticipants = await Participant.find({
            userId: { $nin: winnerUserIds }
        }).select({ userId: 1, username: 1, ticketNumber: 1, avatarUrl: 1, _id: 0 }).lean();

        if (availableParticipants.length === 0) {
            await message.reply('No more available participants to reroll.');
            return;
        }

        const newWinner = availableParticipants[Math.floor(Math.random() * availableParticipants.length)];
        
        await Winner.create({
            userId: newWinner.userId,
            username: newWinner.username,
            ticketNumber: newWinner.ticketNumber,
            position: position,
            wonAt: new Date(),
            avatarUrl: newWinner.avatarUrl
        });

        const ordinal = this.getOrdinal(position);
        const rerollEmbed = new EmbedBuilder()
            .setTitle(`${ordinal} Place Rerolled`)
            .addFields(
                { name: 'Previous Winner', value: `<@${oldWinner.userId}> (Ticket #${oldWinner.ticketNumber})`, inline: false },
                { name: 'New Winner', value: `<@${newWinner.userId}> (Ticket #${newWinner.ticketNumber})`, inline: false },
                { name: 'Position', value: `**${ordinal} Place**`, inline: true }
            )
            .setThumbnail(newWinner.avatarUrl)
            .setTimestamp();

        await message.reply({ embeds: [rerollEmbed] });
        if (message.guild) {
            await this.sendLog(message.guild, { embeds: [rerollEmbed] });
        }
    }

    private async handleResetLottery(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        const totalParticipants = await Participant.countDocuments();
        const totalWinners = await Winner.countDocuments();
        const config = await this.getConfig();

        // Build winners list
        const winners = await Winner.find()
            .select({ position: 1, userId: 1, ticketNumber: 1, _id: 0 })
            .sort({ position: 1 })
            .lean();
        let winnersText = 'None';
        if (winners.length > 0) {
            winnersText = winners.map(w => `${this.getOrdinal(w.position)} Place: <@${w.userId}> (Ticket #${w.ticketNumber})`).join('\n');
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('Reset Lottery?')
            .setDescription('Are you sure you want to reset all lottery data? This cannot be undone.')
            .addFields(
                { name: 'Total Participants', value: `${totalParticipants}`, inline: true },
                { name: 'Total Winners', value: `${totalWinners}`, inline: true },
                { name: 'Lottery Status', value: config?.isActive ? 'Active' : 'Inactive', inline: true },
                { name: 'Winners', value: winnersText, inline: false }
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_reset')
            .setLabel('Confirm Reset')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_reset')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);

        const reply = await message.reply({
            embeds: [confirmEmbed],
            components: [row]
        });

        try {
            const interaction = await reply.awaitMessageComponent({
                filter: i => i.user.id === message.author.id && (i.customId === 'confirm_reset' || i.customId === 'cancel_reset'),
                componentType: ComponentType.Button,
                time: 30000
            });

            if (interaction.customId === 'confirm_reset') {
                await Participant.deleteMany({});
                await Winner.deleteMany({});
                await LotteryConfig.updateOne({}, {
                    isActive: false,
                    ticketCounter: 1
                });

                const resetEmbed = new EmbedBuilder()
                    .setTitle('Lottery Reset')
                    .setDescription('All lottery data has been reset. Channels remain configured.')
                    .addFields(
                        { name: 'Participants Cleared', value: `${totalParticipants}`, inline: true },
                        { name: 'Winners Cleared', value: `${totalWinners}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.update({ embeds: [resetEmbed], components: [] });
                if (message.guild) {
                    await this.sendLog(message.guild, { embeds: [resetEmbed] });
                }
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Reset Cancelled')
                    .setDescription('Lottery data was not reset.')
                    .setTimestamp();

                await interaction.update({ embeds: [cancelEmbed], components: [] });
            }
        } catch (error) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Reset Timeout')
                .setDescription('Reset timed out. Data was not changed.')
                .setTimestamp();

            await reply.edit({ embeds: [timeoutEmbed], components: [] });
        }
    }

    private async handleSetLogChannel(message: Message, channelId: string): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        const cleanChannelId = channelId.replace(/[<>#]/g, '');
        
        try {
            const channel = await message.guild?.channels.fetch(cleanChannelId);
            if (!channel || channel.type !== ChannelType.GuildText) {
                await message.reply('Invalid channel. Please provide a valid text channel.');
                return;
            }

            await LotteryConfig.updateOne({}, { logChannel: cleanChannelId });
            await message.reply(`Log channel set to <#${cleanChannelId}>`);
        } catch (error) {
            await message.reply('Error fetching channel. Please try again.');
        }
    }

    private async handleRefreshLottery(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        try {
            const config = await LotteryConfig.findOne().select({ ticketCounter: 1 }).lean();
            if (!config) {
                await message.reply('Lottery is not configured.');
                return;
            }

            let nextTicketNumber = config.ticketCounter;

            // Find ALL tickets and group by ticket NUMBER (not userId)
            const allTickets = await Participant.find()
                .select({ _id: 1, userId: 1, ticketNumber: 1, claimedAt: 1 })
                .sort({ claimedAt: 1 })
                .lean();
            
            if (allTickets.length === 0) {
                await message.reply('No tickets have been claimed yet.');
                return;
            }

            const usedTicketNumbers = new Set(allTickets.map(ticket => ticket.ticketNumber));

            // Group tickets by TICKET NUMBER to find duplicates
            const ticketNumberMap = new Map<number, typeof allTickets>();
            for (const ticket of allTickets) {
                if (!ticketNumberMap.has(ticket.ticketNumber)) {
                    ticketNumberMap.set(ticket.ticketNumber, []);
                }
                ticketNumberMap.get(ticket.ticketNumber)!.push(ticket);
            }

            // Find duplicate ticket numbers (where multiple users have the same number)
            let totalDuplicatesFixed = 0;
            let usersAffected = 0;
            const affectedTicketNumbers: number[] = [];
            const failedUsers: string[] = [];
            const maxFailedUsersToReport = 20;

            for (const [ticketNumber, tickets] of ticketNumberMap.entries()) {
                if (tickets.length > 1) {
                    affectedTicketNumbers.push(ticketNumber);
                    
                    // Keep the first ticket (earliest claimed), reassign others
                    for (let i = 1; i < tickets.length; i++) {
                        const oldTicket = tickets[i];
                        
                        // Find next available ticket number from in-memory set to avoid extra DB reads.
                        let newTicketNumber = nextTicketNumber;
                        while (usedTicketNumbers.has(newTicketNumber)) {
                            newTicketNumber++;
                        }

                        // Get user info
                        const user = await this.client.users.fetch(oldTicket.userId);
                        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
                        
                        // Generate new ticket image FIRST
                        const ticketBuffer = await this.ticketGenerator.generateTicket(
                            oldTicket.userId,
                            user.username,
                            avatarUrl,
                            newTicketNumber
                        );

                        // Try to send DM BEFORE updating database
                        try {
                            const dmAttachment = new AttachmentBuilder(ticketBuffer, { name: 'ticket.png' });
                            await user.send({
                                content: `**Duplicate Ticket Detected**\n\nYour ticket #${ticketNumber} was a duplicate.\nYou have been assigned a new unique ticket.\n\n**New Ticket Number:** #${newTicketNumber}`,
                                files: [dmAttachment]
                            });

                            // DM sent successfully - NOW update the database
                            await Participant.updateOne(
                                { _id: oldTicket._id },
                                { ticketNumber: newTicketNumber }
                            );

                            usedTicketNumbers.add(newTicketNumber);
                            nextTicketNumber = newTicketNumber + 1;
                            
                            totalDuplicatesFixed++;
                            usersAffected++;

                        } catch (dmError: any) {
                            // DM failed - don't update database, notify admin
                            console.error(`Error sending DM to ${user.username}:`, dmError);
                            if (failedUsers.length < maxFailedUsersToReport) {
                                failedUsers.push(`${user.username} (${user.tag})`);
                            }
                            
                            // Try to notify the user in the channel
                            try {
                                const textChannel = message.channel as TextChannel;
                                await textChannel.send(`<@${user.id}> Your DMs are off. Please enable DMs and contact an admin to refresh your ticket.`);
                            } catch (err) {
                                console.error('Could not notify user in channel:', err);
                            }
                        }
                    }
                }
            }

            if (totalDuplicatesFixed > 0) {
                await LotteryConfig.updateOne({}, { ticketCounter: nextTicketNumber });
            }

            if (totalDuplicatesFixed === 0) {
                await message.reply('No duplicate tickets found. All tickets are unique.');
            } else {
                let resultMessage = `**Refresh Complete**\n\n**Results:**\n- Duplicate ticket numbers found: **${affectedTicketNumbers.join(', ')}**\n- Users affected: **${usersAffected}**\n- New tickets assigned: **${totalDuplicatesFixed}**\n- New tickets sent to affected users via DM`;
                
                if (failedUsers.length > 0) {
                    resultMessage += `\n\n**Failed to send DM:**\n${failedUsers.map(u => `- ${u}`).join('\n')}\n\nThese users need to enable DMs. Admin should run !refresh-lottery again after they enable DMs.`;
                }
                
                await message.reply(resultMessage);
            }

        } catch (error) {
            console.error('Error refreshing lottery:', error);
            await message.reply('An error occurred while checking for duplicates.');
        }
    }

    private async handleRemind(message: Message, reminderMessage: string): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        if (!reminderMessage || reminderMessage.trim() === '') {
            await message.reply('Usage: `!remind <message>`\nExample: `!remind Draw happening in 1 hour!`');
            return;
        }

        try {
            const totalParticipants = await Participant.countDocuments();
            if (totalParticipants === 0) {
                await message.reply('No participants found.');
                return;
            }

            let successCount = 0;
            let failedCount = 0;
            const failedUsers: string[] = [];
            const maxFailedUsersToReport = 10;

            const participantCursor = Participant.find()
                .select({ userId: 1, _id: 0 })
                .lean()
                .cursor();

            // Send DM to each participant
            for await (const participant of participantCursor) {
                try {
                    const user = await this.client.users.fetch(participant.userId);
                    await user.send(`**Lottery Reminder**\n\n${reminderMessage}`);
                    successCount++;
                } catch (dmError) {
                    console.error(`Failed to send DM to ${participant.userId}:`, dmError);
                    failedCount++;
                    if (failedUsers.length < maxFailedUsersToReport) {
                        try {
                            const user = await this.client.users.fetch(participant.userId);
                            failedUsers.push(user.username);
                        } catch {
                            failedUsers.push(`User ID: ${participant.userId}`);
                        }
                    }
                }
            }

            let resultMessage = `**Reminder Sent**\n\n**Results:**\n- Total participants: **${totalParticipants}**\n- Successfully sent: **${successCount}**\n- Failed: **${failedCount}**`;
            
            if (failedUsers.length > 0) {
                resultMessage += `\n\n**Failed to send to:**\n${failedUsers.map(u => `- ${u}`).join('\n')}`;
                if (failedCount > failedUsers.length) {
                    resultMessage += `\n*...and ${failedCount - failedUsers.length} more*`;
                }
            }

            await message.reply(resultMessage);

        } catch (error) {
            console.error('Error sending reminders:', error);
            await message.reply('An error occurred while sending reminders.');
        }
    }

    private async handleLotteryInfo(message: Message): Promise<void> {
        if (!this.isAdmin(message)) {
            await message.reply('You need Administrator permission to use this command.');
            return;
        }

        try {
            const config = await LotteryConfig.findOne()
                .select({ isActive: 1, claimChannel: 1, logChannel: 1, ticketCounter: 1 })
                .lean();
            if (!config) {
                await message.reply('Lottery has not been set up yet. Use `!setup-lottery` first.');
                return;
            }

            const totalParticipants = await Participant.countDocuments();
            const totalWinners = await Winner.countDocuments();
            const ticketsIssued = config.ticketCounter - 1;

            // Pagination settings
            const itemsPerPage = 15;
            const totalPages = Math.ceil(totalParticipants / itemsPerPage) || 1;
            let currentPage = 0;

            const generateEmbed = async (page: number) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageParticipants = await Participant.find()
                    .select({ userId: 1, ticketNumber: 1, _id: 0 })
                    .sort({ ticketNumber: 1 })
                    .skip(start)
                    .limit(itemsPerPage)
                    .lean();
                
                const participantsList = pageParticipants.length > 0 
                    ? pageParticipants.map((p, idx) => `\`${String(start + idx + 1).padStart(3, ' ')}\` <@${p.userId}> -> Ticket **#${p.ticketNumber}**`).join('\n')
                    : '*No participants yet*';

                return new EmbedBuilder()
                    .setTitle('Lottery Dashboard')
                    .setDescription(`**System Status:** ${config.isActive ? '**Active**' : '**Inactive**'}\n----------------------`)
                    .addFields(
                        { 
                            name: 'Statistics', 
                            value: `\`\`\`\nTickets Issued : ${ticketsIssued}\nParticipants   : ${totalParticipants}\nWinners        : ${totalWinners}\`\`\``, 
                            inline: true 
                        },
                        { 
                            name: 'Configuration', 
                            value: `\`\`\`\nClaim Channel\n\`\`\`<#${config.claimChannel}>\n\`\`\`\nLog Channel\n\`\`\`<#${config.logChannel}>`, 
                            inline: true 
                        },
                        { 
                            name: `Participants List - Page ${page + 1} of ${totalPages}`, 
                            value: participantsList, 
                            inline: false 
                        }
                    )
                    .setColor(config.isActive ? 0x57F287 : 0xED4245)
                    .setFooter({ text: `Showing ${Math.min(start + 1, totalParticipants)}-${Math.min(end, totalParticipants)} of ${totalParticipants} participants` })
                    .setTimestamp();
            };

            const generateButtons = (page: number) => {
                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('first_page')
                            .setLabel('First')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('page_info')
                            .setLabel(`${page + 1} / ${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page >= totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('last_page')
                            .setLabel('Last')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page >= totalPages - 1)
                    );
                return row;
            };

            // Send initial message
            const messageOptions: any = { embeds: [await generateEmbed(currentPage)] };
            if (totalPages > 1) {
                messageOptions.components = [generateButtons(currentPage)];
            }
            
            const reply = await message.reply(messageOptions);

            // Only add button collector if there are multiple pages
            if (totalPages > 1) {
                const collector = reply.createMessageComponentCollector({
                    filter: (interaction) => interaction.user.id === message.author.id,
                    time: 600000 // 10 minutes
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.customId === 'next_page' && currentPage < totalPages - 1) {
                        currentPage++;
                    } else if (interaction.customId === 'prev_page' && currentPage > 0) {
                        currentPage--;
                    } else if (interaction.customId === 'first_page') {
                        currentPage = 0;
                    } else if (interaction.customId === 'last_page') {
                        currentPage = totalPages - 1;
                    }

                    await interaction.update({ 
                        embeds: [await generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                });

                collector.on('end', () => {
                    reply.edit({ components: [] }).catch(() => {});
                });
            }

        } catch (error) {
            console.error('Error fetching lottery info:', error);
            await message.reply('An error occurred while fetching lottery information.');
        }
    }

    private async handleHelp(message: Message): Promise<void> {
        const isUserAdmin = this.isAdmin(message);

        const userCommandsEmbed = new EmbedBuilder()
            .setTitle('Lottery Bot Commands')
            .setDescription('Here are all available commands')
            .addFields(
                { name: '!help', value: 'Display this help message', inline: false },
                { name: '!lottery', value: 'Claim your lottery ticket (must be in the claim channel)', inline: false }
            )
            .setTimestamp();

        if (isUserAdmin) {
            userCommandsEmbed.addFields(
                { name: '\nAdmin Commands', value: '\u200b', inline: false },
                { name: '!setup-lottery', value: 'Set up the lottery system (claim and log channels)', inline: false },
                { name: '!setlottery', value: 'Start the lottery (resets tickets to #1)', inline: false },
                { name: '!endlottery', value: 'End the lottery (stops ticket distribution)', inline: false },
                { name: '!refresh-lottery', value: 'Check all users for duplicate tickets and reassign new unique tickets', inline: false },
                { name: '!lottery-info', value: 'Show detailed lottery statistics with pagination', inline: false },
                { name: '!remind <message>', value: 'Send a reminder message to all participants via DM', inline: false },
                { name: '!lotterywinner <place>', value: 'Pick a random winner for a specific place (e.g., !lotterywinner 1)', inline: false },
                { name: '!reroll <place>', value: 'Reroll the winner at a specific place (e.g., !reroll 1)', inline: false },
                { name: '!resetlottery', value: 'Reset all lottery data (keeps channel settings)', inline: false },
                { name: '!logchannel <id>', value: 'Update the log channel', inline: false }
            );
        }

        await message.reply({ embeds: [userCommandsEmbed] });
    }

    private async handleMessage(message: Message): Promise<void> {
        if (message.author.bot) return;

        const content = message.content.toLowerCase();
        const args = message.content.split(' ');

        if (content === '!help') {
            await this.handleHelp(message);
        } else if (content === '!setup-lottery') {
            await this.handleSetupLottery(message);
        } else if (content === '!setlottery') {
            await this.handleSetLottery(message);
        } else if (content === '!lottery') {
            await this.handleClaimTicket(message);
        } else if (content === '!refresh-lottery') {
            await this.handleRefreshLottery(message);
        } else if (content === '!lottery-info') {
            await this.handleLotteryInfo(message);
        } else if (args[0].toLowerCase() === '!remind' && args.length > 1) {
            const reminderMessage = message.content.slice(8).trim();
            await this.handleRemind(message, reminderMessage);
        } else if (args[0].toLowerCase() === '!remind' && args.length === 1) {
            await message.reply('Usage: `!remind <message>`\nExample: `!remind Draw happening in 1 hour!`');
        } else if (content === '!endlottery') {
            await this.handleEndLottery(message);
        } else if (args[0].toLowerCase() === '!lotterywinner' && args[1]) {
            await this.handlePickWinner(message, parseInt(args[1]));
        } else if (args[0].toLowerCase() === '!lotterywinner' && !args[1]) {
            await message.reply('Usage: `!lotterywinner <place>` (e.g., `!lotterywinner 1`)');
        } else if (args[0].toLowerCase() === '!reroll' && args[1]) {
            await this.handleReroll(message, parseInt(args[1]));
        } else if (content === '!resetlottery') {
            await this.handleResetLottery(message);
        } else if (args[0] === '!logchannel' && args[1]) {
            await this.handleSetLogChannel(message, args[1]);
        }
    }

    public start(): void {
        const token = process.env.DISCORD_TOKEN;
        if (!token) {
            console.error('DISCORD_TOKEN not found in environment variables');
            process.exit(1);
        }
        this.client.login(token);
    }
}

const bot = new LotteryBot();
bot.start();
