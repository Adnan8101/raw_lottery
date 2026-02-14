export interface Participant {
    userId: string;
    username: string;
    ticketNumber: number;
    claimedAt: string;
}

export interface Winner extends Participant {
    position: number;
    wonAt: string;
}

export interface LotteryData {
    isActive: boolean;
    claimChannel: string | null;
    logChannel: string | null;
    participants: Participant[];
    ticketCounter: number;
    winners: Winner[];
}

export const DEFAULT_LOTTERY_DATA: LotteryData = {
    isActive: false,
    claimChannel: null,
    logChannel: null,
    participants: [],
    ticketCounter: 1,
    winners: []
};
