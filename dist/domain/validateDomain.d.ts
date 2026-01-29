import type { TaskType } from "../task/types.js";
import type { ScopeCapability } from "../scope/types.js";
import type { DomainManifest } from "./types.js";
export type DomainDecision = Readonly<{
    allowed: boolean;
    reason: string;
    missing?: readonly ScopeCapability[];
}>;
export declare function validateDomainForTask(manifest: DomainManifest, task_type: TaskType, scope: readonly string[]): DomainDecision;
