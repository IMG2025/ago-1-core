import type { DomainExecutor } from "./types.js";

const REGISTRY = new Map<string, DomainExecutor>();

export function registerExecutor(executor: DomainExecutor): void {
  const id = executor.domain_id.trim();
  if (id.length === 0) throw new Error("EXECUTOR_DOMAIN_ID_REQUIRED");
  if (REGISTRY.has(id)) throw new Error(`EXECUTOR_ALREADY_REGISTERED:${id}`);
  REGISTRY.set(id, executor);
}

export function getExecutor(domain_id: string): DomainExecutor | undefined {
  return REGISTRY.get(domain_id.trim());
}

export function listExecutors(): readonly string[] {
  return Array.from(REGISTRY.keys()).sort();
}
