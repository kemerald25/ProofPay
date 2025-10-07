import { Web3Storage, File } from 'web3.storage';
import { Sentry } from '@/config/sentry';

class IPFSService {
    private client: Web3Storage | null = null;

    constructor() {
        const token = process.env.WEB3_STORAGE_TOKEN;
        if (token) {
            this.client = new Web3Storage({ token });
        } else {
            console.warn('WEB3_STORAGE_TOKEN not set. IPFS service will not be available.');
        }
    }

    async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
        if (!this.client) {
            throw new Error('IPFS Service is not initialized.');
        }
        try {
            const file = new File([fileBuffer], filename);
            const cid = await this.client.put([file]);
            return `https://${cid}.ipfs.w3s.link/${filename}`;
        } catch (error) {
            console.error('IPFS uploadFile error:', error);
            Sentry.captureException(error);
            throw new Error('Failed to upload file to IPFS');
        }
    }

    async uploadJSON(jsonData: object): Promise<string> {
         if (!this.client) {
            throw new Error('IPFS Service is not initialized.');
        }
        try {
            const blob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
            const file = new File([blob], 'metadata.json');
            const cid = await this.client.put([file]);
            return `https://${cid}.ipfs.w3s.link/metadata.json`;
        } catch (error) {
            console.error('IPFS uploadJSON error:', error);
            Sentry.captureException(error);
            throw new Error('Failed to upload JSON to IPFS');
        }
    }
}

export default new IPFSService();
