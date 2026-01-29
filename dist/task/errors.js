export class TaskDeniedError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "TaskDeniedError";
        this.code = code;
    }
}
