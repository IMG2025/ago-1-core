import type { TaskType } from "../task/types.js";
import type { ScopeCapability } from "../scope/types.js";

export type DomainStatus = "ACTIVE" | "FROZEN";

export type DomainManifest = Readonly<{
  domain_id: string;
  owner: string;
  status: DomainStatus;
  supported_task_types: readonly TaskType[];
  required_scopes: Readonly<Record<TaskType, readonly ScopeCapability[]>>;
}>;
