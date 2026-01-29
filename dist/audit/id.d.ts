/**
 * Non-cryptographic event id generator.
 * We can replace with crypto.randomUUID() later when stable across runtimes.
 */
export declare function newEventId(): string;
