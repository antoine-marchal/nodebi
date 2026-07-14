import { DbAdapter, FindOptions, AggregateOptions } from './interface';
export declare function closeMongoPool(): Promise<void>;
export declare class MongoAdapter implements DbAdapter {
    private uri;
    private dbName;
    private db;
    constructor(uri: string, dbName: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private col;
    find(opts: FindOptions): Promise<any[]>;
    aggregate(opts: AggregateOptions): Promise<any[]>;
    listCollections(): Promise<string[]>;
}
