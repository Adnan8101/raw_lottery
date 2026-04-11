import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Database } from './database';
import { Participant, Winner, LotteryConfig } from './models';

dotenv.config();

const DEFAULT_GUILD_ID = '1052886751221383198';

type RawFilter = Record<string, unknown>;

interface ParsedArgs {
    guildId: string;
    fix: boolean;
}

interface ScopeInfo {
    participantFilter: RawFilter;
    winnerFilter: RawFilter;
    configFilter: RawFilter;
    mode: 'guild' | 'global';
}

interface ParticipantDoc {
    _id: mongoose.Types.ObjectId;
    userId: string;
    ticketNumber: number;
    claimedAt?: Date;
}

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);
    let guildId = process.env.GUILD_ID ?? DEFAULT_GUILD_ID;
    let fix = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--fix') {
            fix = true;
            continue;
        }

        if (arg === '--guild' || arg === '--guildId') {
            const nextValue = args[i + 1];
            if (!nextValue) {
                throw new Error('Missing value for --guild/--guildId');
            }
            guildId = nextValue;
            i += 1;
            continue;
        }

        if (arg.startsWith('--guild=')) {
            guildId = arg.slice('--guild='.length);
            continue;
        }

        if (arg.startsWith('--guildId=')) {
            guildId = arg.slice('--guildId='.length);
            continue;
        }
    }

    return { guildId, fix };
}

async function resolveScope(guildId: string): Promise<ScopeInfo> {
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('MongoDB connection is not ready');
    }

    const participantsCollection = db.collection('participants');
    const guildFieldProbe = await participantsCollection.findOne(
        {
            $or: [
                { guildId: { $exists: true } },
                { serverId: { $exists: true } },
                { guild: { $exists: true } }
            ]
        },
        {
            projection: { _id: 1 }
        }
    );

    if (!guildFieldProbe) {
        return {
            participantFilter: {},
            winnerFilter: {},
            configFilter: {},
            mode: 'global'
        };
    }

    const guildFilter: RawFilter = {
        $or: [{ guildId }, { serverId: guildId }, { guild: guildId }]
    };

    return {
        participantFilter: guildFilter,
        winnerFilter: guildFilter,
        configFilter: guildFilter,
        mode: 'guild'
    };
}

function countDuplicates(values: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const duplicates = new Map<string, number>();
    for (const [key, count] of counts.entries()) {
        if (count > 1) {
            duplicates.set(key, count);
        }
    }

    return duplicates;
}

function findDuplicateTicketNumbers(participants: ParticipantDoc[]): number[] {
    const counts = new Map<number, number>();
    for (const participant of participants) {
        counts.set(participant.ticketNumber, (counts.get(participant.ticketNumber) ?? 0) + 1);
    }

    return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([ticketNumber]) => ticketNumber)
        .sort((a, b) => a - b);
}

function findMissingTicketNumbers(participants: ParticipantDoc[]): number[] {
    if (participants.length === 0) {
        return [];
    }

    const maxTicket = Math.max(...participants.map((p) => p.ticketNumber));
    const used = new Set(participants.map((p) => p.ticketNumber));
    const missing: number[] = [];

    for (let i = 1; i <= maxTicket; i++) {
        if (!used.has(i)) {
            missing.push(i);
        }
    }

    return missing;
}

async function getConfigForScope(configFilter: RawFilter): Promise<{ _id: mongoose.Types.ObjectId; ticketCounter: number } | null> {
    const scopedConfig = await LotteryConfig.findOne(configFilter)
        .select({ _id: 1, ticketCounter: 1 })
        .lean();

    if (scopedConfig) {
        return {
            _id: scopedConfig._id,
            ticketCounter: scopedConfig.ticketCounter
        };
    }

    const fallbackConfig = await LotteryConfig.findOne()
        .select({ _id: 1, ticketCounter: 1 })
        .lean();

    if (!fallbackConfig) {
        return null;
    }

    return {
        _id: fallbackConfig._id,
        ticketCounter: fallbackConfig.ticketCounter
    };
}

async function audit(scope: ScopeInfo) {
    const participants = await Participant.find(scope.participantFilter)
        .select({ _id: 1, userId: 1, ticketNumber: 1, claimedAt: 1 })
        .sort({ claimedAt: 1, _id: 1 })
        .lean<ParticipantDoc[]>();

    const winnersCount = await Winner.countDocuments(scope.winnerFilter);
    const config = await getConfigForScope(scope.configFilter);

    const duplicateUsers = countDuplicates(participants.map((p) => p.userId));
    const duplicateTicketNumbers = findDuplicateTicketNumbers(participants);
    const missingTickets = findMissingTicketNumbers(participants);
    const invalidTickets = participants.filter((p) => !Number.isInteger(p.ticketNumber) || p.ticketNumber <= 0);
    const ticketsIssued = config ? Math.max(config.ticketCounter - 1, 0) : 0;

    const report = {
        scopeMode: scope.mode,
        participants: participants.length,
        winners: winnersCount,
        configTicketCounter: config?.ticketCounter ?? null,
        ticketsIssuedFromConfig: ticketsIssued,
        ticketsIssuedEqualsParticipants: ticketsIssued === participants.length,
        duplicateUsers: duplicateUsers.size,
        duplicateUserIdsPreview: [...duplicateUsers.keys()].slice(0, 10),
        duplicateTicketNumbers: duplicateTicketNumbers.length,
        duplicateTicketNumbersPreview: duplicateTicketNumbers.slice(0, 15),
        missingTicketNumbers: missingTickets.length,
        missingTicketNumbersPreview: missingTickets.slice(0, 15),
        invalidTicketRecords: invalidTickets.length
    };

    console.log(JSON.stringify(report, null, 2));

    return {
        report,
        participants
    };
}

async function removeDuplicateUsers(scope: ScopeInfo): Promise<number> {
    const participants = await Participant.find(scope.participantFilter)
        .select({ _id: 1, userId: 1, claimedAt: 1 })
        .sort({ claimedAt: 1, _id: 1 })
        .lean<Array<{ _id: mongoose.Types.ObjectId; userId: string }>>();

    const seen = new Set<string>();
    const duplicateIds: mongoose.Types.ObjectId[] = [];

    for (const participant of participants) {
        if (seen.has(participant.userId)) {
            duplicateIds.push(participant._id);
            continue;
        }
        seen.add(participant.userId);
    }

    if (duplicateIds.length === 0) {
        return 0;
    }

    const result = await Participant.deleteMany({ _id: { $in: duplicateIds } });
    return result.deletedCount ?? 0;
}

async function resequenceTickets(scope: ScopeInfo): Promise<{ updatedParticipants: number; userTicketMap: Map<string, number> }> {
    const participants = await Participant.find(scope.participantFilter)
        .select({ _id: 1, userId: 1, ticketNumber: 1, claimedAt: 1 })
        .sort({ claimedAt: 1, _id: 1 })
        .lean<ParticipantDoc[]>();

    const operations: Array<{ updateOne: { filter: { _id: mongoose.Types.ObjectId }; update: { ticketNumber: number } } }> = [];
    const userTicketMap = new Map<string, number>();

    participants.forEach((participant, index) => {
        const nextTicketNumber = index + 1;
        userTicketMap.set(participant.userId, nextTicketNumber);

        if (participant.ticketNumber !== nextTicketNumber) {
            operations.push({
                updateOne: {
                    filter: { _id: participant._id },
                    update: { ticketNumber: nextTicketNumber }
                }
            });
        }
    });

    if (operations.length > 0) {
        await Participant.bulkWrite(operations, { ordered: false });
    }

    return {
        updatedParticipants: operations.length,
        userTicketMap
    };
}

async function syncWinnerTickets(scope: ScopeInfo, userTicketMap: Map<string, number>): Promise<number> {
    const winners = await Winner.find(scope.winnerFilter)
        .select({ _id: 1, userId: 1, ticketNumber: 1 })
        .lean<Array<{ _id: mongoose.Types.ObjectId; userId: string; ticketNumber: number }>>();

    const operations: Array<{ updateOne: { filter: { _id: mongoose.Types.ObjectId }; update: { ticketNumber: number } } }> = [];

    for (const winner of winners) {
        const expectedTicket = userTicketMap.get(winner.userId);
        if (!expectedTicket || expectedTicket === winner.ticketNumber) {
            continue;
        }

        operations.push({
            updateOne: {
                filter: { _id: winner._id },
                update: { ticketNumber: expectedTicket }
            }
        });
    }

    if (operations.length > 0) {
        await Winner.bulkWrite(operations, { ordered: false });
    }

    return operations.length;
}

async function setTicketCounter(scope: ScopeInfo, participantCount: number): Promise<number> {
    const nextTicketCounter = participantCount + 1;
    const config = await getConfigForScope(scope.configFilter);

    if (config) {
        await LotteryConfig.updateOne({ _id: config._id }, { $set: { ticketCounter: nextTicketCounter } });
        return nextTicketCounter;
    }

    await LotteryConfig.create({
        isActive: false,
        claimChannel: null,
        logChannel: null,
        ticketCounter: nextTicketCounter
    });

    return nextTicketCounter;
}

async function run(): Promise<void> {
    const { guildId, fix } = parseArgs();
    const database = Database.getInstance();

    console.log(`Guild ID target: ${guildId}`);
    console.log(`Mode: ${fix ? 'FIX' : 'AUDIT'}`);

    try {
        await database.connect();
        const scope = await resolveScope(guildId);

        if (scope.mode === 'global') {
            console.log('Guild field not found in participants collection. Running in global(single-server) mode.');
        }

        await audit(scope);

        if (!fix) {
            return;
        }

        const deletedDuplicateUsers = await removeDuplicateUsers(scope);
        const resequenceResult = await resequenceTickets(scope);
        const winnerUpdates = await syncWinnerTickets(scope, resequenceResult.userTicketMap);
        const participantCount = resequenceResult.userTicketMap.size;
        const nextTicketCounter = await setTicketCounter(scope, participantCount);

        console.log(
            JSON.stringify(
                {
                    fixSummary: {
                        duplicateUsersDeleted: deletedDuplicateUsers,
                        participantsReticketed: resequenceResult.updatedParticipants,
                        winnersUpdated: winnerUpdates,
                        nextTicketCounter
                    }
                },
                null,
                2
            )
        );

        console.log('Post-fix audit:');
        await audit(scope);
    } finally {
        await database.disconnect();
    }
}

run().catch((error) => {
    console.error('Lottery maintenance script failed:', error);
    process.exitCode = 1;
});