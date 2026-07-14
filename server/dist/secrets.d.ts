import { DataSource } from './types';
interface SecretRecord {
    mongoUri?: string;
}
export declare function storeDataSourceSecret(id: string, secret: SecretRecord): void;
export declare function getDataSourceSecret(id: string): SecretRecord | undefined;
export declare function removeDataSourceSecret(id: string): void;
export declare function hydrate(ds: DataSource): DataSource;
export declare function stripSecrets<T extends {
    dataSources?: DataSource[];
}>(doc: T): T;
export declare function extractAndPersist<T extends {
    _id?: string;
    dataSources?: DataSource[];
}>(doc: T): T;
export {};
