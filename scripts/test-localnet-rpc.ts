#!/usr/bin/env bun
/**
 * @fileoverview Test Localnet RPC functionality
 * @module scripts/test-localnet-rpc
 */

import { $ } from "bun";
import { ethers } from "ethers";

async function main() {
  console.log('🧪 Testing Localnet RPC...\n');

  try {
    // Get L2 RPC port from Kurtosis
    const portOutput = await $`kurtosis port print jeju-localnet op-geth rpc`.text();
    const port = portOutput.trim().split(":")[1];
    const rpcUrl = `http://127.0.0.1:${port}`;

    console.log(`RPC URL: ${rpcUrl}`);

    // Test 1: RPC connectivity
    console.log('\n1. Testing RPC connectivity...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected at block ${blockNumber}`);

    // Test 2: Send transaction
    console.log('\n2. Testing transaction...');
    const privateKey = "0xb71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291";
    const wallet = new ethers.Wallet(privateKey, provider);
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    
    const tx = await wallet.sendTransaction({
      to: recipient,
      value: ethers.parseEther("0.01"),
    });
    
    await tx.wait();
    console.log(`   ✅ Transaction successful: ${tx.hash}`);

    // Test 3: Query balance
    console.log('\n3. Testing balance query...');
    const balance = await provider.getBalance(recipient);
    console.log(`   ✅ Balance: ${ethers.formatEther(balance)} ETH`);

    console.log('\n✅ All RPC tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ RPC test failed:', error.message);
    process.exit(1);
  }
}

main();

