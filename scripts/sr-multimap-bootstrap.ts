/** Set canonical module-level bounds BEFORE any map/policy imports can load it. */
import fs from 'fs';
const d=JSON.parse(fs.readFileSync('research-inputs/sr-multimap-sm01-2026-09-17.json','utf8')).definition;
process.env.SIM_START='2025-07-01T00:00:00Z';
process.env.SIM_END=d.cutoff;
process.env.SIM_EQUITY=String(d.initialEquity);
