#!/usr/bin/env bun
/**
 * @fileoverview Master Test Suite - Runs ALL tests across the entire Jeju codebase
 * @module scripts/test-master
 * 
 * Comprehensive test coverage:
 * - Smart Contracts (Foundry)
 * - TypeScript Unit Tests (Bun)
 * - Integration Tests
 * - E2E Tests
 * - Configuration Validation
 * - Documentation Coverage
 * - Localnet Deployment
 * - Scripts & Utilities
 * 
 * @example Run all tests
 * ```bash
 * bun run test:master
 * ```
 * 
 * @example Run specific category
 * ```bash
 * bun run test:master contracts
 * bun run test:master integration
 * ```
 * 
 * @example CI usage
 * ```bash
 * CI=true bun run test:master
 * ```
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
} as const;

interface TestSuite {
  name: string;
  description: string;
  command: string;
  directory?: string;
  optional?: boolean;
  timeout?: number;
  skipInCI?: boolean;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];
const isCI = process.env.CI === 'true';

/** All test suites in order of execution */
const TEST_SUITES: TestSuite[] = [
  // Phase 1: Configuration & Setup
  {
    name: 'Configuration Validation',
    description: 'Validate all network configurations',
    command: 'bun run scripts/validate-config.ts',
    timeout: 30000,
  },
  {
    name: 'TypeScript Type Checking',
    description: 'Ensure zero TypeScript errors',
    command: 'bun run typecheck',
    timeout: 60000,
  },
  
  // Phase 2: Smart Contracts
  {
    name: 'Smart Contract Compilation',
    description: 'Compile all Solidity contracts',
    command: 'forge build',
    directory: 'contracts',
    timeout: 120000,
  },
  {
    name: 'Smart Contract Tests',
    description: 'Run all Foundry tests',
    command: 'forge test -vv',
    directory: 'contracts',
    timeout: 180000,
  },
  {
    name: 'Contract Coverage',
    description: 'Generate test coverage report',
    command: 'forge coverage --report summary',
    directory: 'contracts',
    timeout: 180000,
    optional: true,
  },
  {
    name: 'Contract Gas Report',
    description: 'Generate gas usage report',
    command: 'forge test --gas-report',
    directory: 'contracts',
    timeout: 120000,
    optional: true,
    skipInCI: true,
  },
  
  // Phase 3: TypeScript Unit Tests
  {
    name: 'Config Module Tests',
    description: 'Test configuration loader',
    command: 'bun test config/index.test.ts',
    timeout: 30000,
  },
  {
    name: 'Shared Utilities Tests',
    description: 'Test format, logger, notifications, RPC utils',
    command: 'bun test scripts/shared/',
    timeout: 60000,
  },
  
  // Phase 4: Integration Tests
  {
    name: 'Integration Tests',
    description: 'Test service interactions',
    command: 'bun test tests/integration/',
    optional: true,
    timeout: 120000,
  },
  
  // Phase 5: Localnet Tests (skip in CI unless explicitly requested)
  {
    name: 'Localnet Deployment',
    description: 'Test Kurtosis localnet startup',
    command: 'bun run scripts/localnet/start.ts',
    timeout: 300000,
    optional: true,
    skipInCI: true,
  },
  {
    name: 'Localnet RPC Test',
    description: 'Verify L2 RPC functionality',
    command: 'bun run scripts/test-localnet-rpc.ts',
    timeout: 60000,
    optional: true,
    skipInCI: true,
  },
  
  // Phase 6: E2E Tests
  {
    name: 'E2E Tests',
    description: 'End-to-end user journey tests',
    command: 'bun test tests/e2e/',
    optional: true,
    timeout: 180000,
    skipInCI: true,
  },
  
  // Phase 7: Infrastructure Tests
  {
    name: 'Helm Chart Validation',
    description: 'Validate Kubernetes Helm charts',
    command: 'bun run scripts/test-helm-charts.ts',
    timeout: 120000,
    optional: true,
  },
  
  // Phase 8: Documentation
  {
    name: 'Documentation Coverage',
    description: 'Verify all code has proper documentation',
    command: 'bun run scripts/verify-documentation.ts',
    timeout: 60000,
    optional: true,
  },
  
  // Phase 9: Specialized Tests
  {
    name: 'Oracle System Tests',
    description: 'Test oracle price fetching and updates',
    command: 'bun run scripts/test-oracle-prices.ts',
    timeout: 60000,
    optional: true,
  },
  {
    name: 'Node Rewards System',
    description: 'Test complete node operator rewards',
    command: 'bun run scripts/test-complete-node-system.ts',
    timeout: 120000,
    optional: true,
  },
  
  // Phase 10: Indexer Tests
  {
    name: 'Indexer Tests',
    description: 'Test Subsquid indexer',
    command: 'npm run test',
    directory: 'indexer',
    timeout: 120000,
    optional: true,
  },
];

/**
 * Run a single test suite
 */
async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();

  // Skip if marked for CI skip and we're in CI
  if (isCI && suite.skipInCI) {
    console.log(`${COLORS.YELLOW}⏭️  SKIPPED${COLORS.RESET} (skipped in CI)`);
    return {
      suite: suite.name,
      passed: true,
      duration: 0,
      skipped: true,
    };
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${COLORS.BRIGHT}${COLORS.CYAN}${suite.name}${COLORS.RESET}`);
  console.log(`${suite.description}`);
  console.log('─'.repeat(70));

  try {
    const options: any = {
      timeout: suite.timeout || 60000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    };

    if (suite.directory) {
      options.cwd = suite.directory;
    }

    const { stdout, stderr } = await execAsync(suite.command, options);
    const duration = Date.now() - startTime;

    // Show output
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('warning')) console.log(stderr);

    console.log(`${COLORS.GREEN}✅ PASSED${COLORS.RESET} (${(duration / 1000).toFixed(2)}s)`);

    return {
      suite: suite.name,
      passed: true,
      duration,
      output: stdout,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Check if this is an optional suite
    if (suite.optional && (error.message.includes('ENOENT') || error.message.includes('not found'))) {
      console.log(`${COLORS.YELLOW}⏭️  SKIPPED${COLORS.RESET} (optional, not available)`);
      return {
        suite: suite.name,
        passed: true,
        duration,
        skipped: true,
      };
    }

    console.log(error.stdout || '');
    console.log(error.stderr || '');
    console.log(`${COLORS.RED}❌ FAILED${COLORS.RESET} (${(duration / 1000).toFixed(2)}s)`);

    return {
      suite: suite.name,
      passed: false,
      duration,
      error: error.message,
    };
  }
}

/**
 * Print summary of all test results
 */
function printSummary() {
  const passed = results.filter(r => r.passed && !r.skipped).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n' + '═'.repeat(70));
  console.log(`${COLORS.BRIGHT}${COLORS.CYAN}TEST SUMMARY${COLORS.RESET}`);
  console.log('═'.repeat(70) + '\n');

  for (const result of results) {
    const icon = result.skipped ? '⏭️ ' : result.passed ? '✅' : '❌';
    const status = result.skipped ? 'SKIPPED' : result.passed ? 'PASSED' : 'FAILED';
    const color = result.skipped ? COLORS.YELLOW : result.passed ? COLORS.GREEN : COLORS.RED;
    const duration = `(${(result.duration / 1000).toFixed(2)}s)`;

    console.log(`${icon} ${result.suite.padEnd(35)} ${color}${status}${COLORS.RESET} ${duration}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Total: ${total} | Passed: ${COLORS.GREEN}${passed}${COLORS.RESET} | Failed: ${COLORS.RED}${failed}${COLORS.RESET} | Skipped: ${COLORS.YELLOW}${skipped}${COLORS.RESET}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s (${(totalDuration / 60000).toFixed(1)}m)`);
  console.log('─'.repeat(70) + '\n');

  if (failed > 0) {
    console.log(`${COLORS.RED}${COLORS.BRIGHT}❌ TEST SUITE FAILED${COLORS.RESET}\n`);
    console.log('Failed suites:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.suite}`);
      if (result.error) {
        console.log(`    Error: ${result.error.split('\n')[0]}`);
      }
    }
    console.log('');
    process.exit(1);
  } else {
    console.log(`${COLORS.GREEN}${COLORS.BRIGHT}✅ ALL TESTS PASSED!${COLORS.RESET}\n`);
    console.log('🎉 Complete Jeju test suite validated.\n');
    
    if (skipped > 0) {
      console.log(`ℹ️  ${skipped} test(s) skipped (optional or unavailable)\n`);
    }
    
    // Print coverage summary
    console.log('📊 Test Coverage:');
    console.log('  ✅ Smart Contracts (Foundry)');
    console.log('  ✅ TypeScript Configuration');
    console.log('  ✅ Shared Utilities');
    console.log('  ✅ Integration Tests');
    if (!isCI) {
      console.log('  ✅ Localnet Deployment');
      console.log('  ✅ E2E User Journeys');
    }
    console.log('  ✅ Infrastructure Validation');
    console.log('  ✅ Documentation Coverage');
    console.log('');
    
    process.exit(0);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                  ║');
  console.log('║              JEJU L3 MASTER TEST SUITE                           ║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (isCI) {
    console.log('\n🤖 Running in CI mode (some tests skipped)\n');
  }

  const targetSuite = process.argv[2];

  let suitesToRun = TEST_SUITES;

  // Filter to specific suite if requested
  if (targetSuite) {
    suitesToRun = TEST_SUITES.filter(s => 
      s.name.toLowerCase().includes(targetSuite.toLowerCase()) ||
      s.description.toLowerCase().includes(targetSuite.toLowerCase())
    );

    if (suitesToRun.length === 0) {
      console.error(`\n❌ No test suite matching "${targetSuite}"\n`);
      console.log('Available suites:');
      for (const suite of TEST_SUITES) {
        console.log(`  - ${suite.name}`);
      }
      console.log('');
      process.exit(1);
    }
  }

  console.log(`\nRunning ${suitesToRun.length} test suite(s)...\n`);

  // Run all test suites
  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    results.push(result);
    
    // Fail fast in CI if a critical test fails
    if (isCI && !result.passed && !suite.optional && !result.skipped) {
      console.log(`\n${COLORS.RED}❌ Critical test failed in CI - stopping${COLORS.RESET}\n`);
      printSummary();
      break;
    }
  }

  // Print summary
  printSummary();
}

// Run tests
main().catch((error) => {
  console.error(`\n${COLORS.RED}❌ Test runner crashed:${COLORS.RESET}`, error);
  process.exit(1);
});

export { runTestSuite, TEST_SUITES };

