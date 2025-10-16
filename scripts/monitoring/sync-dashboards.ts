#!/usr/bin/env bun

/**
 * Sync Grafana Dashboards
 * 
 * Uploads Grafana dashboards to Kubernetes
 * 
 * Usage:
 *   bun run scripts/monitoring/sync-dashboards.ts
 */

import { readdirSync } from "fs";
import { join } from "path";

console.log("📊 Syncing Grafana Dashboards to Kubernetes...\n");

const dashboardsDir = join(process.cwd(), "monitoring", "grafana", "dashboards");
const dashboards = readdirSync(dashboardsDir).filter(f => f.endsWith('.json'));

console.log(`Found ${dashboards.length} dashboards:\n`);

for (const dashboard of dashboards) {
  console.log(`  - ${dashboard}`);
}

console.log("\n📝 To deploy dashboards:");
console.log("");
console.log("Option 1: ConfigMap (Simple)");
console.log("  kubectl create configmap grafana-dashboards \\");
console.log("    --from-file=monitoring/grafana/dashboards/ \\");
console.log("    -n monitoring");
console.log("");
console.log("Option 2: Grafana API (Dynamic)");
console.log("  for dash in monitoring/grafana/dashboards/*.json; do");
console.log("    curl -X POST http://grafana:3000/api/dashboards/db \\");
console.log("      -H 'Content-Type: application/json' \\");
console.log("      -d @$dash");
console.log("  done");
console.log("");
console.log("Option 3: Helm values (Recommended)");
console.log("  Add to Grafana Helm values:");
console.log("  dashboards:");
console.log("    default:");
console.log("      jeju-op-stack:");
console.log("        file: dashboards/op-stack.json");
console.log("      jeju-subsquid:");
console.log("        file: dashboards/subsquid-overview.json");


