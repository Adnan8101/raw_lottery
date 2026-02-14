import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant extends Document {
    userId: string;
    username: string;
    ticketNumber: number;
    claimedAt: Date;
    avatarUrl: string;
}

export interface IWinner extends Document {
    userId: string;
    username: string;
    ticketNumber: number;
    position: number;
    wonAt: Date;
    avatarUrl: string;
}

export interface ILotteryConfig extends Document {
    isActive: boolean;
    claimChannel: string | null;
    logChannel: string | null;
    ticketCounter: number;
}

const ParticipantSchema = new Schema<IParticipant>({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    ticketNumber: { type: Number, required: true },
    claimedAt: { type: Date, default: Date.now },
    avatarUrl: { type: String, required: true }
});

const WinnerSchema = new Schema<IWinner>({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    ticketNumber: { type: Number, required: true },
    position: { type: Number, required: true },
    wonAt: { type: Date, default: Date.now },
    avatarUrl: { type: String, required: true }
});

const LotteryConfigSchema = new Schema<ILotteryConfig>({
    isActive: { type: Boolean, default: false },
    claimChannel: { type: String, default: null },
    logChannel: { type: String, default: null },
    ticketCounter: { type: Number, default: 1 }
});

export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
export const Winner = mongoose.model<IWinner>('Winner', WinnerSchema);
export const LotteryConfig = mongoose.model<ILotteryConfig>('LotteryConfig', LotteryConfigSchema);
