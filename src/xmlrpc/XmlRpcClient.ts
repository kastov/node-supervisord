import got, { Options as GotOptions } from 'got';

import { Encoding, XmlRpcStruct, XmlRpcValue, XmlRpcValueOrFault } from './XmlRpcTypes';
import { serializeMethodCall } from './Serializer';
import { Deserializer } from './Deserializer';
import { XmlRpcFault } from './XmlRpcFault';

export interface XmlRpcClientOptions {
    encoding?: Encoding;
    headers?: Record<string, string>;
    /** Additional got options */
    gotOptions?: GotOptions;
}

// A client for making XML-RPC method calls over HTTP(S)
export class XmlRpcClient {
    url: string;
    encoding?: Encoding;
    headers: Record<string, string> = {
        'Content-Type': 'text/xml',
        Accept: 'text/xml',
    };
    gotOptions?: GotOptions;

    constructor(url: string, options?: XmlRpcClientOptions) {
        this.url = url;
        this.encoding = options?.encoding;
        this.gotOptions = options?.gotOptions;
        if (options?.headers != undefined) {
            this.headers = { ...this.headers, ...options.headers };
        }
    }

    // Make an XML-RPC call to the server and return the response
    async methodCall(method: string, params?: XmlRpcValue[]): Promise<XmlRpcValue> {
        const body = serializeMethodCall(method, params, this.encoding);

        let resText: string;
        try {
            const response = await got.post(this.url, {
                body,
                headers: this.headers,
                responseType: 'text',
                enableUnixSockets: true,
                ...this.gotOptions,
            });
            resText = response.body;
        } catch (err) {
            const error = err as { code?: string } & Error;
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error(`XML-RPC call "${method}" to ${this.url} failed to connect`);
            }
            throw err;
        }

        const deserializer = new Deserializer(this.encoding);
        return await deserializer.deserializeMethodResponse(resText);
    }

    async multiMethodCall(
        requests: { methodName: string; params: XmlRpcValue[] }[],
    ): Promise<XmlRpcValueOrFault[]> {
        const res = await this.methodCall('system.multicall', [requests]);
        if (!Array.isArray(res) || res.length !== requests.length) {
            throw new Error(`malformed system.multicall response`);
        }

        const output: XmlRpcValueOrFault[] = [];

        const createFault = (fault: XmlRpcStruct = {}) => {
            const faultString =
                typeof fault.faultString === 'string' ? fault.faultString : undefined;
            const faultCode = typeof fault.faultCode === 'number' ? fault.faultCode : undefined;
            return new XmlRpcFault(faultString, faultCode);
        };

        for (const entry of res) {
            if (!Array.isArray(entry) || entry.length !== 1) {
                output.push(createFault(entry as XmlRpcStruct));
            } else {
                output.push(entry[0]);
            }
        }

        return output;
    }
}
