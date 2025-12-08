#!/usr/bin/env bun
/**
 * LOCALNET SIMULATION RUNNER
 * 
 * Runs comprehensive simulations against deployed contracts on localnet.
 * 
 * Prerequisites:
 *   1. Start localnet: bun run localnet:start
 *   2. Deploy contracts: bun run scripts/deploy-all-localnet-contracts.ts
 *   3. Run this script: bun run scripts/run-localnet-simulations.ts
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'bun'

const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
}

async function checkPrerequisites(): Promise<boolean> {
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}Checking prerequisites...${COLORS.RESET}\n`)

  // Check if localnet is running
  try {
    const response = await fetch('http://localhost:9545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    })
    
    if (!response.ok) {
      console.error(`${COLORS.RED}❌ Localnet not responding at http://localhost:9545${COLORS.RESET}`)
      console.log('   Run: bun run localnet:start')
      return false
    }
    
    console.log(`${COLORS.GREEN}✅ Localnet is running${COLORS.RESET}`)
  } catch {
    console.error(`${COLORS.RED}❌ Cannot connect to localnet${COLORS.RESET}`)
    console.log('   Run: bun run localnet:start')
    return false
  }

  // Check for deployed contracts
  const deploymentsDir = join(process.cwd(), '../..', 'contracts/deployments')
  const requiredDeployments = [
    'uniswap-v4-1337.json',
    'bazaar-marketplace-1337.json',
    'erc20-factory-1337.json',
  ]

  let allDeployed = true
  for (const file of requiredDeployments) {
    const path = join(deploymentsDir, file)
    if (existsSync(path)) {
      const deployment = JSON.parse(readFileSync(path, 'utf-8'))
      const address = Object.values(deployment)[0]
      console.log(`${COLORS.GREEN}✅ ${file.replace('-1337.json', '')}: ${address}${COLORS.RESET}`)
    } else {
      console.error(`${COLORS.RED}❌ Missing: ${file}${COLORS.RESET}`)
      allDeployed = false
    }
  }

  if (!allDeployed) {
    console.log('\n   Run: bun run scripts/deploy-all-localnet-contracts.ts')
    return false
  }

  return true
}

async function runTests(): Promise<number> {
  console.log(`\n${COLORS.CYAN}${COLORS.BRIGHT}Running localnet simulations...${COLORS.RESET}\n`)

  const proc = spawn({
    cmd: ['bun', 'test', 'tests/integration/'],
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  await proc.exited
  return proc.exitCode ?? 1
}

async function main() {
  console.log(`\n${COLORS.CYAN}${COLORS.BRIGHT}╔═══════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`)
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}║                                                                       ║${COLORS.RESET}`)
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}║   🧪 BAZAAR LOCALNET SIMULATION SUITE                                 ║${COLORS.RESET}`)
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}║                                                                       ║${COLORS.RESET}`)
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}╚═══════════════════════════════════════════════════════════════════════╝${COLORS.RESET}\n`)

  // Check prerequisites
  const ready = await checkPrerequisites()
  if (!ready) {
    console.log(`\n${COLORS.RED}Prerequisites not met. Please fix the issues above.${COLORS.RESET}`)
    process.exit(1)
  }

  // Run tests
  const exitCode = await runTests()

  if (exitCode === 0) {
    console.log(`\n${COLORS.GREEN}${COLORS.BRIGHT}✅ ALL SIMULATIONS PASSED!${COLORS.RESET}\n`)
  } else {
    console.log(`\n${COLORS.RED}${COLORS.BRIGHT}❌ SOME SIMULATIONS FAILED${COLORS.RESET}\n`)
  }

  process.exit(exitCode)
}

main()

