# AGO-1 Core Runtime

**Owner:** CHC  
**Role:** Canonical execution runtime for all AGO-1 domains  
**Status:** Active

This repository contains the single authoritative AGO-1 runtime.
All domain-specific logic (CIAG, Hospitality, etc.) must plug in as
domain packs under `/domains`.

No domain may reimplement the runtime.
