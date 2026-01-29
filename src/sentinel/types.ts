export type SentinelAuthDecision = Readonly<{
  allowed: boolean;
  reason: string;
  policy_id?: string;
}>;

export type SentinelAuthRequest = Readonly<{
  authority_token: string;
  sentinel_policy_id?: string;
  requested_by?: string;
}>;
