import fs from "node:fs";
import path from "node:path";
export function loadDomainManifest(domain_id) {
    const clean = domain_id.trim();
    if (clean.length === 0) {
        throw new Error("DOMAIN_ID_REQUIRED");
    }
    const p = path.resolve(process.cwd(), "domains", clean, "domain.json");
    if (!fs.existsSync(p)) {
        throw new Error(`DOMAIN_NOT_REGISTERED:${clean}`);
    }
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
        throw new Error(`DOMAIN_MANIFEST_INVALID:${clean}`);
    }
    if (parsed.domain_id !== clean) {
        throw new Error(`DOMAIN_MANIFEST_MISMATCH:${clean}`);
    }
    return parsed;
}
