export type ScopeCapability = "task:execute" | "task:analyze" | "task:escalate";
export type ScopeDecision = Readonly<{
    allowed: boolean;
    reason: string;
    missing?: readonly ScopeCapability[];
}>;
