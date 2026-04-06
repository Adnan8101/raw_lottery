/// <reference types="node" />

import { TicketGenerator } from './src/ticketGenerator';
import fs from 'fs';
import path from 'path';

async function testTicket() {
    const generator = new TicketGenerator();

    // Use a public Discord-style avatar for test rendering.
    const testAvatarUrl = 'https://cdn.discordapp.com/embed/avatars/4.png';
    
    try {
        const buffer = await generator.generateTicket(
            '123456789012345678',  // userId
            'Rashika Sharma',      // username
            testAvatarUrl,         // avatarUrl
            1,                     // ticketNumber => 0001
            {
                serverName: 'Villain Arc',
                claimedAt: new Date('2026-04-07T20:00:00+05:30'),
                displayName: 'Rashika Sharma'
            }
        );
        
        const outputPath = path.join(__dirname, 'tickets', 'test_ticket.png');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Test ticket generated: ${outputPath}`);
        console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`);
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testTicket();
