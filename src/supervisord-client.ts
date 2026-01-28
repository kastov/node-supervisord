import { $SupervisorMethod, SupervisordClientMethod } from './methods';
import { XmlRpcClient, XmlRpcValue } from './xmlrpc';

export interface SupervisordClientOptions {
    username: string;
    password: string;
}

export class SupervisordClient extends SupervisordClientMethod {
    private client: XmlRpcClient;

    constructor(connectionUrl: string, options?: SupervisordClientOptions) {
        super();

        this.client = new XmlRpcClient(connectionUrl, {
            encoding: 'utf-8',
            headers: this.createHeaders(options),
        });
    }

    async _call(method: string, params: XmlRpcValue[]): Promise<XmlRpcValue> {
        return this.client.methodCall(method, params);
    }

    private createHeaders(options?: SupervisordClientOptions) {
        if (!options) {
            return undefined;
        }

        const { username, password } = options;
        const encoded = Buffer.from(username + ':' + password).toString('base64');
        return { Authorization: `Basic ${encoded}` };
    }
}

$SupervisorMethod.forEach((method) => {
    const methodName = method.split('.').pop();
    (SupervisordClient.prototype as any)[methodName] = function (...params: XmlRpcValue[]) {
        return this._call(method, params);
    };
});
