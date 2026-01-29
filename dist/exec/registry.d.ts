import type { DomainExecutor } from "./types.js";
export declare function registerExecutor(executor: DomainExecutor): void;
export declare function getExecutor(domain_id: string): DomainExecutor | undefined;
export declare function listExecutors(): readonly string[];
