import fs from 'fs';
import path from 'path';
import { LotteryData, DEFAULT_LOTTERY_DATA } from './types';

export class DataManager {
    private dataFile: string;
    private data: LotteryData;

    constructor() {
        this.dataFile = path.join(__dirname, '..', 'lottery_data.json');
        this.data = { ...DEFAULT_LOTTERY_DATA };
        this.load();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(fileContent);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    public save(): void {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    public getData(): LotteryData {
        return this.data;
    }

    public setData(data: Partial<LotteryData>): void {
        this.data = { ...this.data, ...data };
        this.save();
    }

    public reset(): void {
        const { claimChannel, logChannel } = this.data;
        this.data = {
            ...DEFAULT_LOTTERY_DATA,
            claimChannel,
            logChannel
        };
        this.save();
    }
}
