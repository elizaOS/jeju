#!/usr/bin/env bun
/**
 * @title Example Node Operator Setup
 * @notice Complete example of registering and running a node operator
 */

import { ethers } from 'ethers';

// Configuration
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'http://localhost:8545',
  PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY || '',
  REWARDS_CONTRACT: process.env.REWARDS_CONTRACT || '',
  TOKEN_ADDRESS: process.env.TOKEN_ADDRESS || '',
  RPC_URL_TO_REGISTER: process.env.NODE_RPC_URL || 'https://rpc.example.com',
  GEOGRAPHIC_REGION: process.env.REGION || 'North America',
  STAKE_AMOUNT: process.env.STAKE_AMOUNT || '1000',
};

// ABIs
const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const REWARDS_ABI = [
  'function registerNode(string calldata rpcUrl, string calldata geographicRegion, uint256 stakeAmount) external returns (bytes32 nodeId)',
  'function deregisterNode(bytes32 nodeId) external',
  'function claimRewards(bytes32 nodeId) external',
  'function calculateRewards(bytes32 nodeId) external view returns (uint256)',
  'function getNodeInfo(bytes32 nodeId) external view returns (tuple(address operator, string rpcUrl, uint256 stakedAmount, uint256 registrationTime, uint256 totalRewardsClaimed, uint256 lastClaimTime, bool isActive, bool isSlashed), tuple(uint256 uptimeScore, uint256 requestsServed, uint256 avgResponseTime, uint256 lastUpdateTime, string geographicRegion), uint256 pendingRewards)',
  'function getOperatorNodes(address operator) external view returns (bytes32[])',
  'event NodeRegistered(bytes32 indexed nodeId, address indexed operator, string rpcUrl, uint256 stakedAmount)',
];

class NodeOperatorSetup {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private token: ethers.Contract;
  private rewards: ethers.Contract;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    this.token = new ethers.Contract(CONFIG.TOKEN_ADDRESS, TOKEN_ABI, this.wallet);
    this.rewards = new ethers.Contract(CONFIG.REWARDS_CONTRACT, REWARDS_ABI, this.wallet);
  }
  
  async checkBalance() {
    console.log('\n📊 Checking Balances...');
    
    const balance = await this.token.balanceOf(this.wallet.address);
    const stakeRequired = ethers.parseEther(CONFIG.STAKE_AMOUNT);
    
    console.log(`   Wallet: ${this.wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} JEJU`);
    console.log(`   Required: ${ethers.formatEther(stakeRequired)} JEJU`);
    
    if (balance < stakeRequired) {
      throw new Error(`Insufficient balance. Need ${ethers.formatEther(stakeRequired)} JEJU`);
    }
    
    return balance;
  }
  
  async approveStake() {
    console.log('\n✅ Approving Stake...');
    
    const stakeAmount = ethers.parseEther(CONFIG.STAKE_AMOUNT);
    const currentAllowance = await this.token.allowance(
      this.wallet.address,
      CONFIG.REWARDS_CONTRACT
    );
    
    if (currentAllowance >= stakeAmount) {
      console.log('   Already approved ✓');
      return;
    }
    
    console.log(`   Approving ${ethers.formatEther(stakeAmount)} JEJU...`);
    
    const tx = await this.token.approve(CONFIG.REWARDS_CONTRACT, stakeAmount);
    console.log(`   Transaction: ${tx.hash}`);
    
    await tx.wait();
    console.log('   Approved ✓');
  }
  
  async registerNode(): Promise<string> {
    console.log('\n🚀 Registering Node...');
    console.log(`   RPC URL: ${CONFIG.RPC_URL_TO_REGISTER}`);
    console.log(`   Region: ${CONFIG.GEOGRAPHIC_REGION}`);
    console.log(`   Stake: ${CONFIG.STAKE_AMOUNT} JEJU`);
    
    const stakeAmount = ethers.parseEther(CONFIG.STAKE_AMOUNT);
    
    const tx = await this.rewards.registerNode(
      CONFIG.RPC_URL_TO_REGISTER,
      CONFIG.GEOGRAPHIC_REGION,
      stakeAmount,
      {
        gasLimit: 500000,
      }
    );
    
    console.log(`   Transaction: ${tx.hash}`);
    console.log('   Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    // Parse event to get nodeId
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.rewards.interface.parseLog(log);
        return parsed?.name === 'NodeRegistered';
      } catch {
        return false;
      }
    });
    
    if (!event) {
      throw new Error('NodeRegistered event not found');
    }
    
    const parsed = this.rewards.interface.parseLog(event);
    const nodeId = parsed?.args[0];
    
    console.log('\n✅ Node Registered Successfully!');
    console.log(`   Node ID: ${nodeId}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    
    return nodeId;
  }
  
  async getNodeInfo(nodeId: string) {
    console.log('\n📊 Node Information...');
    
    const [node, perf, pendingRewards] = await this.rewards.getNodeInfo(nodeId);
    
    console.log(`   Node ID: ${nodeId}`);
    console.log(`   Operator: ${node.operator}`);
    console.log(`   RPC URL: ${node.rpcUrl}`);
    console.log(`   Staked: ${ethers.formatEther(node.stakedAmount)} JEJU`);
    console.log(`   Status: ${node.isActive ? '🟢 Active' : '🔴 Inactive'}`);
    console.log(`   Slashed: ${node.isSlashed ? '❌ Yes' : '✅ No'}`);
    console.log('\n   Performance:');
    console.log(`   - Uptime: ${(Number(perf.uptimeScore) / 100).toFixed(2)}%`);
    console.log(`   - Requests: ${perf.requestsServed.toLocaleString()}`);
    console.log(`   - Avg Response: ${perf.avgResponseTime}ms`);
    console.log(`   - Region: ${perf.geographicRegion}`);
    console.log('\n   Rewards:');
    console.log(`   - Pending: ${ethers.formatEther(pendingRewards)} JEJU`);
    console.log(`   - Total Claimed: ${ethers.formatEther(node.totalRewardsClaimed)} JEJU`);
    
    const daysSinceRegistration = (Date.now() / 1000 - Number(node.registrationTime)) / 86400;
    console.log(`   - Days Active: ${daysSinceRegistration.toFixed(1)}`);
    
    return { node, perf, pendingRewards };
  }
  
  async claimRewards(nodeId: string) {
    console.log('\n💰 Claiming Rewards...');
    
    const pending = await this.rewards.calculateRewards(nodeId);
    
    if (pending === 0n) {
      console.log('   No rewards to claim yet');
      return;
    }
    
    console.log(`   Pending: ${ethers.formatEther(pending)} JEJU`);
    
    const tx = await this.rewards.claimRewards(nodeId, {
      gasLimit: 200000,
    });
    
    console.log(`   Transaction: ${tx.hash}`);
    
    await tx.wait();
    
    console.log('   ✅ Rewards claimed successfully!');
  }
  
  async getOperatorSummary() {
    console.log('\n📊 Operator Summary...');
    
    const nodeIds = await this.rewards.getOperatorNodes(this.wallet.address);
    
    console.log(`   Total Nodes: ${nodeIds.length}`);
    
    let totalStaked = 0n;
    let totalRewards = 0n;
    let activeCount = 0;
    
    for (const nodeId of nodeIds) {
      const [node, , pendingRewards] = await this.rewards.getNodeInfo(nodeId);
      
      totalStaked += node.stakedAmount;
      totalRewards += pendingRewards;
      
      if (node.isActive && !node.isSlashed) {
        activeCount++;
      }
      
      console.log(`\n   Node: ${nodeId.slice(0, 10)}...`);
      console.log(`     Status: ${node.isActive ? '🟢' : '🔴'}`);
      console.log(`     Staked: ${ethers.formatEther(node.stakedAmount)} JEJU`);
      console.log(`     Pending: ${ethers.formatEther(pendingRewards)} JEJU`);
    }
    
    console.log('\n   Summary:');
    console.log(`   - Active Nodes: ${activeCount}/${nodeIds.length}`);
    console.log(`   - Total Staked: ${ethers.formatEther(totalStaked)} JEJU`);
    console.log(`   - Total Pending Rewards: ${ethers.formatEther(totalRewards)} JEJU`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  if (!CONFIG.PRIVATE_KEY) {
    console.error('❌ OPERATOR_PRIVATE_KEY environment variable required');
    process.exit(1);
  }
  
  if (!CONFIG.REWARDS_CONTRACT) {
    console.error('❌ REWARDS_CONTRACT environment variable required');
    process.exit(1);
  }
  
  if (!CONFIG.TOKEN_ADDRESS) {
    console.error('❌ TOKEN_ADDRESS environment variable required');
    process.exit(1);
  }
  
  const setup = new NodeOperatorSetup();
  
  try {
    switch (command) {
      case 'register':
        console.log('🚀 Node Operator Registration\n');
        await setup.checkBalance();
        await setup.approveStake();
        const nodeId = await setup.registerNode();
        
        // Save node ID for future reference
        console.log('\n📝 Save this Node ID:');
        console.log(`   export NODE_ID="${nodeId}"`);
        console.log('\n🎉 Registration complete!');
        console.log('\nNext steps:');
        console.log('1. Wait for performance oracle to update your stats');
        console.log('2. After 1 day, claim rewards: bun run node:claim $NODE_ID');
        console.log('3. Check status: bun run node:info $NODE_ID');
        break;
        
      case 'info':
        const nodeIdInfo = args[1] || process.env.NODE_ID;
        if (!nodeIdInfo) {
          console.error('❌ Node ID required: bun run node:info <nodeId>');
          process.exit(1);
        }
        await setup.getNodeInfo(nodeIdInfo);
        break;
        
      case 'claim':
        const nodeIdClaim = args[1] || process.env.NODE_ID;
        if (!nodeIdClaim) {
          console.error('❌ Node ID required: bun run node:claim <nodeId>');
          process.exit(1);
        }
        await setup.claimRewards(nodeIdClaim);
        break;
        
      case 'summary':
        await setup.getOperatorSummary();
        break;
        
      case 'balance':
        await setup.checkBalance();
        break;
        
      default:
        console.log('Jeju Node Operator CLI\n');
        console.log('Commands:');
        console.log('  register  - Register a new node');
        console.log('  info      - Get node information');
        console.log('  claim     - Claim pending rewards');
        console.log('  summary   - Get operator summary');
        console.log('  balance   - Check token balance');
        console.log('\nExample:');
        console.log('  bun run node:register');
        console.log('  bun run node:info $NODE_ID');
        console.log('  bun run node:claim $NODE_ID');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { NodeOperatorSetup };

