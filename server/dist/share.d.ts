interface Payload {
    id: string;
    exp?: number;
}
export declare function createToken(p: Payload): string;
export declare function verifyToken(token: string): Payload | null;
export {};
