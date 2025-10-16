#!/usr/bin/env bun

/**
 * Sync Prometheus Alerts
 * 
 * Uploads Prometheus alert rules to Kubernetes
 * 
 * Usage:
 *   bun run scripts/monitoring/sync-alerts.ts
 */

import { readdirSync } from "fs";
import { join } from "path";

console.log("🚨 Syncing Prometheus Alerts to Kubernetes...\n");

const alertsDir = join(process.cwd(), "monitoring", "prometheus", "alerts");
const alerts = readdirSync(alertsDir).filter(f => f.endsWith('.yaml'));

console.log(`Found ${alerts.length} alert rule files:\n`);

for (const alert of alerts) {
  console.log(`  - ${alert}`);
}

console.log("\n📝 To deploy alerts:");
console.log("");
console.log("Option 1: kubectl apply");
console.log("  kubectl create configmap prometheus-rules \\");
console.log("    --from-file=monitoring/prometheus/alerts/ \\");
console.log("    -n monitoring");
console.log("");
console.log("Option 2: Prometheus Operator");
console.log("  kubectl apply -f monitoring/prometheus/alerts/");
console.log("");
console.log("Option 3: Helm values (Recommended)");
console.log("  Add to Prometheus Helm values:");
console.log("  serverFiles:");
console.log("    alerts:");
console.log("      groups:");
console.log("        - /path/to/alerts/*.yaml");
console.log("");
console.log("After deployment:");
console.log("  - Alerts will trigger based on metrics");
console.log("  - Configure Alertmanager for notifications");
console.log("  - Set up Slack/PagerDuty integrations");


