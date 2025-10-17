#!/usr/bin/env bun
/**
 * @title Node Collector
 * @notice Discovers and monitors Jeju nodes across the network
 * 
 * Discovery methods:
 * - P2P network scanning
 * - DNS seed nodes
 * - Community registry
 * - Bootnode queries
 */

import { ethers } from 'ethers';

// ============ Configuration ============

const API_URL = process.env.API_URL || 'http://localhost:3002';
const COLLECTOR_PRIVATE_KEY = process.env.COLLECTOR_PRIVATE_KEY || '';
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '300000'); // 5 minutes
const RPC_TIMEOUT = 5000;

// Known seed nodes
const SEED_NODES = [
  'https://rpc.jeju.network',
  'https://testnet-rpc.jeju.network',
];

// ============ Node Discovery ============

interface DiscoveredNode {
  rpcUrl: string;
  wsUrl?: string;
  version?: string;
  blockNumber?: number;
  peerCount?: number;
  isSyncing: boolean;
  responseTime: number;
}

async function checkNode(rpcUrl: string): Promise<DiscoveredNode | null> {
  const startTime = Date.now();
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
    });
    
    // Set timeout
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), RPC_TIMEOUT);
    });
    
    // Fetch node info
    const [blockNumber, network, syncStatus] = await Promise.race([
      Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
        provider.send('eth_syncing', []).catch(() => false),
      ]),
      timeout,
    ]) as any;
    
    const responseTime = Date.now() - startTime;
    
    // Get peer count
    let peerCount = 0;
    try {
      const peerCountHex = await provider.send('net_peerCount', []);
      peerCount = parseInt(peerCountHex, 16);
    } catch {}
    
    // Get version
    let version = 'unknown';
    try {
      version = await provider.send('web3_clientVersion', []);
    } catch {}
    
    return {
      rpcUrl,
      version,
      blockNumber,
      peerCount,
      isSyncing: syncStatus !== false,
      responseTime,
    };
  } catch (error) {
    console.error(`Failed to check node ${rpcUrl}:`, error);
    return null;
  }
}

async function discoverPeersFromNode(rpcUrl: string): Promise<string[]> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Try to get admin peers (may not be exposed)
    try {
      const peers = await provider.send('admin_peers', []);
      return peers.map((p: any) => p.network.remoteAddress);
    } catch {}
    
    // Fallback: return empty
    return [];
  } catch {
    return [];
  }
}

/**
 * Get operator address from node RPC
 * Tries to query custom endpoint or derive from coinbase
 */
async function getNodeOperatorAddress(rpcUrl: string): Promise<string | null> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Try custom endpoint (if node exposes it)
    try {
      const operator = await provider.send('jeju_operatorAddress', []);
      if (ethers.isAddress(operator)) {
        return operator;
      }
    } catch {}
    
    // Try to get coinbase (mining address)
    try {
      const coinbase = await provider.send('eth_coinbase', []);
      if (ethers.isAddress(coinbase) && coinbase !== ethers.ZeroAddress) {
        return coinbase;
      }
    } catch {}
    
    return null;
  } catch {
    return null;
  }
}

// ============ Registration ============

async function registerNode(node: DiscoveredNode, operatorAddress: string): Promise<void> {
  const wallet = new ethers.Wallet(COLLECTOR_PRIVATE_KEY);
  
  // Create signature
  const message = `Register node: ${node.rpcUrl}`;
  const signature = await wallet.signMessage(message);
  
  try {
    const response = await fetch(`${API_URL}/nodes/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_address: operatorAddress,
        rpc_url: node.rpcUrl,
        ws_url: node.wsUrl,
        version: node.version,
        signature,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Registered node: ${data.node_id}`);
  } catch (error) {
    console.error(`❌ Failed to register ${node.rpcUrl}:`, error);
  }
}

async function sendHeartbeat(nodeId: string, node: DiscoveredNode): Promise<void> {
  const wallet = new ethers.Wallet(COLLECTOR_PRIVATE_KEY);
  
  // Create signature
  const message = `Heartbeat: ${nodeId}:${Date.now()}`;
  const signature = await wallet.signMessage(message);
  
  try {
    const response = await fetch(`${API_URL}/nodes/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: nodeId,
        block_number: node.blockNumber,
        peer_count: node.peerCount,
        is_syncing: node.isSyncing,
        response_time: node.responseTime,
        signature,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.statusText}`);
    }
    
    console.log(`💓 Heartbeat sent for ${nodeId}`);
  } catch (error) {
    console.error(`❌ Failed to send heartbeat for ${nodeId}:`, error);
  }
}

// ============ Main Collector Loop ============

async function scanNetwork() {
  console.log('\n🔍 Starting network scan...');
  
  const discoveredNodes = new Set<string>();
  const nodesToCheck = [...SEED_NODES];
  
  while (nodesToCheck.length > 0) {
    const rpcUrl = nodesToCheck.shift()!;
    
    if (discoveredNodes.has(rpcUrl)) continue;
    discoveredNodes.add(rpcUrl);
    
    console.log(`\n📡 Checking ${rpcUrl}...`);
    
    const node = await checkNode(rpcUrl);
    
    if (node) {
      console.log(`✅ Node is online`);
      console.log(`   Block: ${node.blockNumber}`);
      console.log(`   Peers: ${node.peerCount}`);
      console.log(`   Response: ${node.responseTime}ms`);
      console.log(`   Syncing: ${node.isSyncing}`);
      
      // Register/update node
      // Try to get operator address from node metadata
      // If not available, use a deterministic address based on RPC URL
      const operatorAddress = await getNodeOperatorAddress(rpcUrl) || 
                             ethers.getAddress(ethers.id(rpcUrl).slice(0, 42));
      
      await registerNode(node, operatorAddress);
      
      // Discover peers
      const peers = await discoverPeersFromNode(rpcUrl);
      console.log(`   Discovered ${peers.length} peers`);
      
      // Add peers to check list
      peers.forEach(peer => {
        if (!discoveredNodes.has(peer)) {
          nodesToCheck.push(peer);
        }
      });
    } else {
      console.log(`❌ Node is offline or unreachable`);
    }
  }
  
  console.log(`\n✅ Scan complete. Discovered ${discoveredNodes.size} nodes.`);
}

async function monitorKnownNodes() {
  console.log('\n💓 Monitoring known nodes...');
  
  try {
    const response = await fetch(`${API_URL}/nodes?limit=1000`);
    const data = await response.json();
    const nodes = data.nodes || [];
    
    console.log(`Found ${nodes.length} registered nodes`);
    
    for (const node of nodes) {
      console.log(`\n📊 Checking ${node.rpc_url}...`);
      
      const status = await checkNode(node.rpc_url);
      
      if (status) {
        await sendHeartbeat(node.id, status);
      } else {
        console.log(`❌ Node ${node.id} is offline`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to monitor nodes:', error);
  }
}

// ============ Start Collector ============

async function main() {
  console.log('🚀 Jeju Node Collector starting...');
  console.log(`   API: ${API_URL}`);
  console.log(`   Scan interval: ${SCAN_INTERVAL / 1000}s`);
  
  if (!COLLECTOR_PRIVATE_KEY) {
    console.error('❌ COLLECTOR_PRIVATE_KEY environment variable required');
    process.exit(1);
  }
  
  const wallet = new ethers.Wallet(COLLECTOR_PRIVATE_KEY);
  console.log(`   Collector address: ${wallet.address}`);
  
  // Initial scan
  await scanNetwork();
  
  // Periodic monitoring
  setInterval(async () => {
    try {
      await monitorKnownNodes();
    } catch (error) {
      console.error('❌ Monitoring failed:', error);
    }
  }, SCAN_INTERVAL);
  
  // Periodic full scan (less frequent)
  setInterval(async () => {
    try {
      await scanNetwork();
    } catch (error) {
      console.error('❌ Scan failed:', error);
    }
  }, SCAN_INTERVAL * 6); // Every 30 minutes if scan interval is 5 minutes
  
  console.log('\n✅ Collector running. Press Ctrl+C to stop.\n');
}

if (import.meta.main) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { checkNode, scanNetwork, monitorKnownNodes };

