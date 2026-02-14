import mongoose from 'mongoose';

export class Database {
    private static instance: Database;
    private connected: boolean = false;

    private constructor() {}

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        try {
            await mongoose.connect(mongoUri);
            this.connected = true;
            console.log('Connected to MongoDB successfully');
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.connected) {
            await mongoose.disconnect();
            this.connected = false;
            console.log('Disconnected from MongoDB');
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }
}
