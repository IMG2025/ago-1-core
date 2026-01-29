import { registerExecutor } from "./registry.js";
import { hospitalityExecutor } from "./executors/hospitality.js";
// Register built-in executors (deterministic).
// If we ever want "no built-ins", we can remove this import from dispatch.
registerExecutor(hospitalityExecutor);
