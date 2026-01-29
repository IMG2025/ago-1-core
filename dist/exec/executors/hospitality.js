import { validateHospitalityInputs } from "./hospitality/validate.js";
import { handleHospitality } from "./hospitality/handlers.js";
import { enforceHospitalityActionScopes } from "./hospitality/scopes.js";
function ok(task, output) {
    return {
        status: "OK",
        task_id: task.task_id,
        domain_id: task.domain_id,
        task_type: task.task_type,
        output
    };
}
function err(task, message) {
    return {
        status: "ERROR",
        task_id: task.task_id,
        domain_id: task.domain_id,
        task_type: task.task_type,
        error: message,
        output: { error: message }
    };
}
export const hospitalityExecutor = {
    domain_id: "hospitality",
    supports: ["EXECUTE", "ANALYZE", "ESCALATE"],
    execute(task) {
        try {
            const inputs = validateHospitalityInputs(task.inputs);
            // Action-level least-privilege scope enforcement
            const scopeDecision = enforceHospitalityActionScopes(inputs, task.scope);
            if (!scopeDecision.allowed) {
                const missing = scopeDecision.missing ? scopeDecision.missing.join(",") : "";
                return err(task, `HOSPITALITY_SCOPE_INSUFFICIENT:${missing}`);
            }
            const output = handleHospitality(inputs);
            return ok(task, {
                executor: "hospitalityExecutor",
                mode: "TEMPLATED_STUB",
                ...output
            });
        }
        catch (e) {
            const msg = e?.message ? String(e.message) : "HOSPITALITY_INPUT_INVALID";
            return err(task, msg);
        }
    }
};
