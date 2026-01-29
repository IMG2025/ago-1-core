export declare class TaskDeniedError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
