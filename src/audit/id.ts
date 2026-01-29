/**
 * Non-cryptographic event id generator.
 * We can replace with crypto.randomUUID() later when stable across runtimes.
 */
export function newEventId(): string {
  const now = Date.now().toString(16);
  const rnd = Math.floor(Math.random() * 1e16).toString(16).padStart(12, "0");
  return `evt_${now}_${rnd}`;
}
