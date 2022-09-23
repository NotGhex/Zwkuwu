import { RecipleClient } from 'reciple';
import BaseModule from '../BaseModule';

export class ReportModule extends BaseModule {
    public async onStart(client: RecipleClient<boolean>): Promise<boolean> {
        return true;
    }
}

export default new ReportModule();