import Nedb from '@seald-io/nedb';
import { DbAdapter, FindOptions, AggregateOptions } from './interface';
export declare class NedbAdapter implements DbAdapter {
    private basePath;
    private stores;
    constructor(basePath: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getStore(collection: string): Nedb;
    find(opts: FindOptions): Promise<any[]>;
    aggregate(opts: AggregateOptions): Promise<any[]>;
    private applyStage;
    private applyGroup;
    listCollections(): Promise<string[]>;
}
