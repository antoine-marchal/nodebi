export interface FindOptions {
    collection: string;
    query?: object;
    limit?: number;
    skip?: number;
}
export interface AggregateOptions {
    collection: string;
    pipeline: object[];
}
export interface DbAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    find(opts: FindOptions): Promise<any[]>;
    aggregate(opts: AggregateOptions): Promise<any[]>;
    listCollections(): Promise<string[]>;
}
