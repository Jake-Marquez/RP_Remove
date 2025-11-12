import Dexie, { Table } from 'dexie';

export interface Device {
  id?: number;
  hostPort: string; // Composite key: "host:port"
  host: string;
  port: number;
  name: string;
  description: string;
  version: string;
  lastSeen: string;
  discovered: string;
  apiKey?: string; // Optional API key for authentication
}

export interface Remote {
  id?: number;
  name: string;
  created: string;
  updated: string;
}

export interface RemoteFunction {
  id?: number;
  remoteId: number;
  deviceHost: string;
  devicePort: number;
  functionId: string;
  added: string;
}

export class RPManagerDB extends Dexie {
  devices!: Table<Device>;
  remotes!: Table<Remote>;
  remoteFunctions!: Table<RemoteFunction>;

  constructor() {
    super('RPManagerDB');
    this.version(2).stores({
      devices: '++id, hostPort, host, name, lastSeen',
      remotes: '++id, name, created',
      remoteFunctions: '++id, remoteId, deviceHost, devicePort, functionId',
    });
  }
}

export const db = new RPManagerDB();
