#!/usr/bin/env bun
/**
 * @fileoverview Test Helm chart validity
 * @module scripts/test-helm-charts
 */

import { $ } from "bun";

const charts = [
  "bundler",
  "eigenda",
  "metabase",
  "op-batcher",
  "op-challenger",
  "op-node",
  "op-proposer",
  "reth",
  "rpc-gateway",
  "subsquid",
];

async function main() {
  console.log('🧪 Testing Helm Charts...\n');

  // Check if helm is installed
  const helmCheck = await $`which helm`.quiet().nothrow();
  if (helmCheck.exitCode !== 0) {
    console.log('⚠️  Helm not installed, skipping Helm validation');
    console.log('   Install helm: https://helm.sh/docs/intro/install/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  for (const chart of charts) {
    const chartPath = `kubernetes/helm/${chart}`;
    console.log(`\nTesting ${chart}...`);

    // Test 1: Lint
    console.log(`  Linting...`);
    const lintResult = await $`helm lint ${chartPath}`.nothrow();
    if (lintResult.exitCode !== 0) {
      console.log(`  ❌ Lint failed`);
      failed++;
      continue;
    }

    // Test 2: Template
    console.log(`  Templating...`);
    const templateResult = await $`helm template ${chartPath}`.quiet().nothrow();
    if (templateResult.exitCode !== 0) {
      console.log(`  ❌ Template failed`);
      failed++;
      continue;
    }

    console.log(`  ✅ ${chart} passed`);
    passed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ Some Helm charts failed validation');
    process.exit(1);
  } else {
    console.log('\n✅ All Helm charts passed validation');
    process.exit(0);
  }
}

main();

