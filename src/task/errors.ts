export class TaskDeniedError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TaskDeniedError";
    this.code = code;
  }
}
