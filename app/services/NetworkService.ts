import * as connectivity from 'tns-core-modules/connectivity';
import { EventData, Observable } from 'tns-core-modules/data/observable';
import { clog } from '~/utils/logging';

export const NetworkConnectionStateEvent = 'NetworkConnectionStateEvent';
export interface NetworkConnectionStateEventData extends EventData {
    data: {
        connected: boolean;
        connectionType: connectivity.connectionType;
    };
}
export class NetworkService extends Observable {
    _connectionType: connectivity.connectionType = connectivity.connectionType.none;
    _connected = false;
    get connected() {
        return this._connected;
    }
    set connected(value: boolean) {
        if (this._connected !== value) {
            this._connected = value;
            this.notify({
                eventName: NetworkConnectionStateEvent,
                object: this,
                data: {
                    connected: value,
                    connectionType: this._connectionType
                }
            } as NetworkConnectionStateEventData);
        }
    }
    get connectionType() {
        return this._connectionType;
    }
    set connectionType(value: connectivity.connectionType) {
        if (this._connectionType !== value) {
            this._connectionType = value;
            this.connected = value !== connectivity.connectionType.none;
        }
    }
    constructor() {
        super();
        clog('creating NetworkHandler Handler');
    }
    start() {
        connectivity.startMonitoring(this.onConnectionStateChange);
        this.connectionType = connectivity.getConnectionType();
    }
    stop() {
        connectivity.stopMonitoring();
    }
    onConnectionStateChange = (newConnectionType: connectivity.connectionType) => {
        this.connectionType = newConnectionType;
    }
}
