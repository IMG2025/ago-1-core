import { validateTask } from "../task/validateTask.js";
import { dispatch } from "./dispatch.js";

export function intakeAndDispatch(task: unknown) {
  const validated = validateTask(task);
  return dispatch(validated);
}
