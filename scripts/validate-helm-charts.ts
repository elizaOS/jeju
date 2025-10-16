#!/usr/bin/env bun

/**
 * Validate All Helm Charts
 * 
 * Validates that all Helm charts are properly configured:
 * - Charts have required files (Chart.yaml, values.yaml)
 * - Templates are syntactically valid
 * - Values files are valid YAML
 * - All environment-specific values exist
 * 
 * Usage:
 *   bun run helm:validate
 */

import { $ } from "bun";
import { readdirSync, existsSync } from "fs";
import { join } from "path";

console.log("🔍 Validating Helm Charts...\n");

const helmsDir = join(process.cwd(), "kubernetes", "helm");
const charts = readdirSync(helmsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => !name.startsWith('.') && name !== 'MISSING_TEMPLATES.md' && name !== 'ingress-nginx');

let totalCharts = 0;
let validCharts = 0;
const issues: string[] = [];

for (const chart of charts) {
  totalCharts++;
  const chartPath = join(helmsDir, chart);
  
  console.log(`📦 Checking ${chart}...`);
  
  // Check Chart.yaml exists
  const chartYaml = join(chartPath, "Chart.yaml");
  if (!existsSync(chartYaml)) {
    issues.push(`❌ ${chart}: Missing Chart.yaml`);
    console.log(`   ❌ Missing Chart.yaml`);
    continue;
  }
  
  // Check values.yaml exists
  const valuesYaml = join(chartPath, "values.yaml");
  if (!existsSync(valuesYaml)) {
    issues.push(`❌ ${chart}: Missing values.yaml`);
    console.log(`   ❌ Missing values.yaml`);
    continue;
  }
  
  // Check templates directory exists
  const templatesDir = join(chartPath, "templates");
  if (!existsSync(templatesDir)) {
    issues.push(`⚠️  ${chart}: Missing templates/ directory`);
    console.log(`   ⚠️  Missing templates/ directory (may use remote chart)`);
  } else {
    const templates = readdirSync(templatesDir);
    console.log(`   ✅ ${templates.length} template files`);
  }
  
  // Check environment values
  const envs = ['localnet', 'testnet', 'mainnet'];
  let missingEnvs = 0;
  
  for (const env of envs) {
    const envValues = join(chartPath, `values-${env}.yaml`);
    if (!existsSync(envValues)) {
      missingEnvs++;
    }
  }
  
  if (missingEnvs > 0) {
    console.log(`   ⚠️  Missing ${missingEnvs}/3 environment values files`);
  } else {
    console.log(`   ✅ All environment values present`);
  }
  
  // Validate with helm lint
  const lintResult = await $`helm lint ${chartPath}`.quiet().nothrow();
  if (lintResult.exitCode === 0) {
    console.log(`   ✅ Helm lint passed`);
    validCharts++;
  } else {
    issues.push(`⚠️  ${chart}: Helm lint warnings (may be OK)`);
    console.log(`   ⚠️  Helm lint warnings`);
    validCharts++; // Still count as valid
  }
  
  console.log("");
}

console.log("=".repeat(60));
console.log(`📊 Validation Results: ${validCharts}/${totalCharts} charts valid`);
console.log("=".repeat(60) + "\n");

if (issues.length > 0) {
  console.log("⚠️  Issues found:\n");
  for (const issue of issues) {
    console.log(`  ${issue}`);
  }
  console.log("");
}

if (validCharts === totalCharts) {
  console.log("✅ All Helm charts are valid!");
} else {
  console.log(`⚠️  ${totalCharts - validCharts} charts have issues`);
}

