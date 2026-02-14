import { TicketGenerator } from './src/ticketGenerator';
import fs from 'fs';
import path from 'path';

async function testTicket() {
    const generator = new TicketGenerator();
    
    // Use a placeholder avatar (a solid color circle will show if URL fails)
    const testAvatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    try {
        const buffer = await generator.generateTicket(
            '123456789012345678',  // userId
            'TestUser',            // username
            testAvatarUrl,         // avatarUrl
            42                     // ticketNumber
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
