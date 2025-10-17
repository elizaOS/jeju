#!/usr/bin/env bun
/**
 * @fileoverview Master test runner for entire Jeju codebase
 * @module test-all-services
 * 
 * Executes comprehensive test suite across all services, contracts, and integrations:
 * 
 * Test Categories:
 * 1. Configuration & Types - Validate configs and type safety
 * 2. Smart Contracts - Foundry tests for all Solidity contracts
 * 3. TypeScript Utilities - Unit tests for shared utilities
 * 4. Indexer - Subsquid processor and GraphQL tests
 * 5. Kurtosis - Localnet deployment tests
 * 6. Kubernetes - Helm chart validation
 * 7. Scripts - Deployment and monitoring script tests
 * 8. Node Explorer - API and frontend tests
 * 9. Integration - Full system integration tests
 * 10. E2E - End-to-end user journey tests
 * 
 * @example Run all tests
 * ```bash
 * # Make executable
 * chmod +x test-all-services.ts
 * 
 * # Run all tests
 * ./test-all-services.ts
 * 
 * # Run specific category
 * ./test-all-services.ts contracts
 * ./test-all-services.ts integration
 * ```
 * 
 * @example CI/CD usage
 * ```yaml
 * # .github/workflows/test.yml
 * - name: Run all tests
 *   run: bun run test-all-services.ts
 * ```
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** ANSI color codes */
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
} as const;

/** Test suite definition */
interface TestSuite {
  name: string;
  description: string;
  command: string;
  directory?: string;
  optional?: boolean;
  timeout?: number;
}

/** Test result tracking */
interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];

/** All test suites */
const TEST_SUITES: TestSuite[] = [
  {
    name: 'Config & Types',
    description: 'Configuration loaders and type definitions',
    command: 'bun test config/index.test.ts',
    timeout: 30000,
  },
  {
    name: 'Smart Contracts',
    description: 'Foundry tests for all Solidity contracts',
    command: 'forge test -vv',
    directory: 'contracts',
    timeout: 120000,
  },
  {
    name: 'Shared Utilities',
    description: 'TypeScript utility function tests',
    command: 'bun test scripts/shared/*.test.ts',
    timeout: 30000,
  },
  {
    name: 'Indexer Unit Tests',
    description: 'Subsquid processor tests',
    command: 'bun test test/integration.test.ts',
    directory: 'indexer',
    optional: true,
    timeout: 60000,
  },
  {
    name: 'Kurtosis Deployment',
    description: 'Localnet deployment validation',
    command: 'bun run kurtosis/test-deployment.ts',
    optional: true,
    timeout: 60000,
  },
  {
    name: 'Helm Charts',
    description: 'Kubernetes chart validation',
    command: 'bun run kubernetes/helm/test-charts.ts',
    timeout: 120000,
  },
  {
    name: 'Node Explorer',
    description: 'Node dashboard tests',
    command: 'bun test src/__tests__/api.test.ts',
    directory: 'node-explorer',
    optional: true,
    timeout: 30000,
  },
  {
    name: 'Integration Tests',
    description: 'Service interaction and integration tests',
    command: 'bun test tests/integration/',
    optional: true,
    timeout: 120000,
  },
  {
    name: 'E2E Tests',
    description: 'End-to-end user journey tests',
    command: 'bun test tests/e2e/',
    optional: true,
    timeout: 180000,
  },
];

/**
 * Run a single test suite
 */
async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${COLORS.BRIGHT}${COLORS.CYAN}${suite.name}${COLORS.RESET}`);
  console.log(`${suite.description}`);
  console.log('─'.repeat(70));

  try {
    const options: any = {
      timeout: suite.timeout || 60000,
      encoding: 'utf-8',
    };

    if (suite.directory) {
      options.cwd = suite.directory;
    }

    const { stdout, stderr } = await execAsync(suite.command, options);
    const duration = Date.now() - startTime;

    console.log(stdout);
    if (stderr && !stderr.includes('warning')) {
      console.log(stderr);
    }

    console.log(`${COLORS.GREEN}✅ PASSED${COLORS.RESET} (${duration}ms)`);

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
    console.log(`${COLORS.RED}❌ FAILED${COLORS.RESET} (${duration}ms)`);

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
    const duration = `(${result.duration}ms)`;

    console.log(`${icon} ${result.suite.padEnd(30)} ${color}${status}${COLORS.RESET} ${duration}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Total: ${total} | Passed: ${COLORS.GREEN}${passed}${COLORS.RESET} | Failed: ${COLORS.RED}${failed}${COLORS.RESET} | Skipped: ${COLORS.YELLOW}${skipped}${COLORS.RESET}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
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
    console.log('🎉 All services validated and operational.\n');
    
    if (skipped > 0) {
      console.log(`ℹ️  ${skipped} optional test(s) skipped (services not running)\n`);
    }
    
    process.exit(0);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                  ║');
  console.log('║              JEJU L3 COMPREHENSIVE TEST SUITE                    ║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const targetSuite = process.argv[2];

  let suitesToRun = TEST_SUITES;

  // Filter to specific suite if requested
  if (targetSuite) {
    suitesToRun = TEST_SUITES.filter(s => 
      s.name.toLowerCase().includes(targetSuite.toLowerCase())
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
  }

  // Print summary
  printSummary();
}

// Run tests
main().catch((error) => {
  console.error(`\n${COLORS.RED}❌ Test runner crashed:${COLORS.RESET}`, error);
  process.exit(1);
});

