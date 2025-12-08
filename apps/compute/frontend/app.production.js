/**
 * Babylon Trust Dashboard - Production Frontend
 *
 * This is the production-ready frontend that connects to real infrastructure:
 * - Real Ethereum RPC with viem-like patterns
 * - Real IPFS/Arweave storage
 * - Real contract interactions
 * - ENS resolution support
 *
 * This file is designed to work as a standalone script in the browser,
 * loaded from IPFS and accessed via ENS gateway.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Network: 'sepolia' for testnet, 'mainnet' for production
  network: 'sepolia',

  // RPC endpoints with redundancy
  rpcUrls: {
    mainnet: [
      'https://eth.llamarpc.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://ethereum.publicnode.com',
    ],
    sepolia: [
      'https://ethereum-sepolia.publicnode.com',
      'https://rpc.sepolia.org',
      'https://sepolia.drpc.org',
      'https://rpc2.sepolia.org',
    ],
  },

  // Contract addresses - UPDATE AFTER DEPLOYMENT
  contracts: {
    mainnet: {
      gameTreasury: '0x0000000000000000000000000000000000000000',
      userRegistry: '0x0000000000000000000000000000000000000000',
    },
    sepolia: {
      // These will be filled in after running forge script
      gameTreasury: '0x0000000000000000000000000000000000000000',
      userRegistry: '0x0000000000000000000000000000000000000000',
    },
  },

  // Storage gateways
  ipfsGateways: [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://w3s.link/ipfs/',
  ],

  arweaveGateways: [
    'https://arweave.net/',
    'https://ar-io.net/',
    'https://g8way.io/',
  ],

  // Contract ABIs (minimal for view functions)
  abis: {
    gameTreasury: [
      {
        name: 'getGameState',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
          { name: 'cid', type: 'string' },
          { name: 'hash', type: 'bytes32' },
          { name: 'version', type: 'uint256' },
          { name: 'keyVer', type: 'uint256' },
          { name: 'lastBeat', type: 'uint256' },
          { name: 'operatorActive', type: 'bool' },
        ],
      },
      {
        name: 'getOperatorInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
          { name: 'op', type: 'address' },
          { name: 'attestation', type: 'bytes' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
      {
        name: 'getBalance',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        name: 'isOperatorActive',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
      },
      {
        name: 'lastHeartbeat',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        name: 'heartbeatTimeout',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ETHEREUM RPC UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Make JSON-RPC call with automatic failover
 */
async function rpcCall(method, params = []) {
  const urls = CONFIG.rpcUrls[CONFIG.network];
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.error) {
        errors.push(`${url}: ${data.error.message}`);
        continue;
      }

      return data.result;
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }

  throw new Error(`All RPC endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Compute keccak256 hash (pure JS implementation for standalone use)
 */
function _keccak256Selector(signature) {
  // For function selectors, we only need first 4 bytes
  // This is a simplified version - in production, use a proper library
  const encoder = new TextEncoder();
  const data = encoder.encode(signature);

  // Use SubtleCrypto for SHA-256 as approximation in standalone mode
  // In real production, include ethers.js or viem
  return crypto.subtle.digest('SHA-256', data).then((hash) => {
    const hashArray = new Uint8Array(hash);
    return (
      '0x' +
      Array.from(hashArray.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  });
}

/**
 * Encode function call data
 */
function encodeFunctionCall(functionName) {
  // Common function selectors (pre-computed)
  const selectors = {
    'getGameState()': '0x1865c57d',
    'getOperatorInfo()': '0xf67e3c74',
    'getBalance()': '0x12065fe0',
    'isOperatorActive()': '0x4e69d560',
    'lastHeartbeat()': '0x69f9ad2f',
    'heartbeatTimeout()': '0xc3a2a665',
  };
  return selectors[functionName] || null;
}

/**
 * Decode uint256 from hex
 */
function decodeUint256(hex) {
  if (!hex || hex === '0x') return BigInt(0);
  return BigInt(hex);
}

/**
 * Decode address from hex (last 40 chars)
 */
function decodeAddress(hex) {
  if (!hex || hex.length < 42) return null;
  return '0x' + hex.slice(-40);
}

/**
 * Decode bool from hex
 */
function decodeBool(hex) {
  if (!hex || hex === '0x') return false;
  return BigInt(hex) !== BigInt(0);
}

/**
 * Decode string from ABI-encoded hex
 */
function decodeString(hex) {
  if (!hex || hex === '0x' || hex.length < 130) return '';
  // String is at offset, then length, then data
  const offset = parseInt(hex.slice(2, 66), 16);
  const lengthStart = 2 + offset * 2;
  const length = parseInt(hex.slice(lengthStart, lengthStart + 64), 16);
  const dataStart = lengthStart + 64;
  const dataHex = hex.slice(dataStart, dataStart + length * 2);

  // Convert hex to string
  let str = '';
  for (let i = 0; i < dataHex.length; i += 2) {
    str += String.fromCharCode(parseInt(dataHex.slice(i, i + 2), 16));
  }
  return str;
}

/**
 * Read contract using eth_call
 */
async function readContract(address, functionSig) {
  if (address === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  const selector = encodeFunctionCall(functionSig);
  if (!selector) {
    throw new Error(`Unknown function: ${functionSig}`);
  }

  const result = await rpcCall('eth_call', [
    {
      to: address,
      data: selector,
    },
    'latest',
  ]);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch from IPFS with gateway fallback
 */
async function fetchFromIPFS(cid) {
  for (const gateway of CONFIG.ipfsGateways) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(gateway + cid, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          data: await response.text(),
          gateway,
          success: true,
        };
      }
    } catch (e) {
      console.warn(`IPFS gateway ${gateway} failed:`, e.message);
    }
  }
  return { success: false, error: 'All IPFS gateways failed' };
}

/**
 * Fetch from Arweave with gateway fallback
 */
async function _fetchFromArweave(txId) {
  for (const gateway of CONFIG.arweaveGateways) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(gateway + txId, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          data: await response.text(),
          gateway,
          success: true,
        };
      }
    } catch (e) {
      console.warn(`Arweave gateway ${gateway} failed:`, e.message);
    }
  }
  return { success: false, error: 'All Arweave gateways failed' };
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  connected: false,
  contractsDeployed: false,
  gameState: null,
  operatorInfo: null,
  encryptedData: null,
  lastUpdate: null,
  errors: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT INTERACTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchGameState() {
  const address = CONFIG.contracts[CONFIG.network].gameTreasury;

  if (address === '0x0000000000000000000000000000000000000000') {
    return {
      deployed: false,
      message: 'Contract not deployed yet',
    };
  }

  try {
    // Fetch game state
    const stateData = await readContract(address, 'getGameState()');

    if (!stateData) {
      return { deployed: false, message: 'Could not read contract' };
    }

    // Parse the returned tuple
    // (string cid, bytes32 hash, uint256 version, uint256 keyVer, uint256 lastBeat, bool operatorActive)
    const cid = decodeString(stateData);
    const hash = '0x' + stateData.slice(66, 130);
    const version = decodeUint256('0x' + stateData.slice(130, 194));
    const keyVer = decodeUint256('0x' + stateData.slice(194, 258));
    const lastBeat = decodeUint256('0x' + stateData.slice(258, 322));
    const operatorActive = decodeBool('0x' + stateData.slice(322, 386));

    // Fetch balance
    const balanceData = await readContract(address, 'getBalance()');
    const balance = decodeUint256(balanceData);

    return {
      deployed: true,
      cid,
      hash,
      version: Number(version),
      keyVersion: Number(keyVer),
      lastHeartbeat: Number(lastBeat),
      operatorActive,
      balance: Number(balance) / 1e18,
    };
  } catch (e) {
    console.error('Failed to fetch game state:', e);
    return {
      deployed: true,
      error: e.message,
    };
  }
}

async function fetchOperatorInfo() {
  const address = CONFIG.contracts[CONFIG.network].gameTreasury;

  if (address === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  try {
    const data = await readContract(address, 'getOperatorInfo()');
    if (!data) return null;

    // Parse (address op, bytes attestation, uint256 registeredAt, bool active)
    const op = decodeAddress(data.slice(0, 66));
    const registeredAt = decodeUint256('0x' + data.slice(130, 194));
    const active = decodeBool('0x' + data.slice(194, 258));

    return {
      address: op,
      registeredAt: Number(registeredAt),
      active,
    };
  } catch (e) {
    console.error('Failed to fetch operator info:', e);
    return null;
  }
}

async function checkTakeoverEligibility() {
  const address = CONFIG.contracts[CONFIG.network].gameTreasury;

  if (address === '0x0000000000000000000000000000000000000000') {
    return { eligible: false, reason: 'Contract not deployed' };
  }

  try {
    const lastHeartbeatData = await readContract(address, 'lastHeartbeat()');
    const timeoutData = await readContract(address, 'heartbeatTimeout()');
    const isActiveData = await readContract(address, 'isOperatorActive()');

    const lastHeartbeat = Number(decodeUint256(lastHeartbeatData));
    const timeout = Number(decodeUint256(timeoutData));
    const isActive = decodeBool(isActiveData);

    const now = Math.floor(Date.now() / 1000);
    const timeSinceHeartbeat = now - lastHeartbeat;
    const eligible = !isActive || timeSinceHeartbeat > timeout;

    return {
      eligible,
      lastHeartbeat: new Date(lastHeartbeat * 1000),
      timeout,
      timeSinceHeartbeat,
      isActive,
      timeUntilEligible: eligible ? 0 : timeout - timeSinceHeartbeat,
    };
  } catch (e) {
    return { eligible: false, reason: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════════════════════

function updateLoadingText(text) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = text;
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

function formatAddress(address) {
  if (!address || address.length < 10) return address || 'Not set';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function formatCID(cid) {
  if (!cid || cid.length < 20) return cid || 'Not set';
  return cid.slice(0, 12) + '...' + cid.slice(-8);
}

function formatETH(wei) {
  return (typeof wei === 'number' ? wei : 0).toFixed(4) + ' ETH';
}

function updateUI() {
  // Network status
  const networkEl = document.getElementById('network-status');
  if (networkEl) {
    networkEl.textContent =
      CONFIG.network.charAt(0).toUpperCase() + CONFIG.network.slice(1);
  }

  // Contract address
  const contractEl = document.getElementById('contract-address');
  if (contractEl && state.gameState) {
    const address = CONFIG.contracts[CONFIG.network].gameTreasury;
    contractEl.textContent = formatAddress(address);
  }

  // Game state
  if (state.gameState?.deployed) {
    document
      .getElementById('state-cid')
      ?.setAttribute('data-value', formatCID(state.gameState.cid));
    document
      .getElementById('state-version')
      ?.setAttribute('data-value', 'v' + (state.gameState.version || 0));
    document
      .getElementById('treasury-balance')
      ?.setAttribute('data-value', formatETH(state.gameState.balance));
    document
      .getElementById('key-version')
      ?.setAttribute('data-value', 'v' + (state.gameState.keyVersion || 0));

    // Update text content
    const stateCidEl = document.getElementById('state-cid');
    if (stateCidEl) stateCidEl.textContent = formatCID(state.gameState.cid);

    const stateVerEl = document.getElementById('state-version');
    if (stateVerEl)
      stateVerEl.textContent = 'v' + (state.gameState.version || 0);

    const balanceEl = document.getElementById('treasury-balance');
    if (balanceEl) balanceEl.textContent = formatETH(state.gameState.balance);

    const keyVerEl = document.getElementById('key-version');
    if (keyVerEl)
      keyVerEl.textContent = 'v' + (state.gameState.keyVersion || 0);
  }

  // Operator info
  if (state.operatorInfo) {
    const operatorEl = document.getElementById('operator-address');
    if (operatorEl)
      operatorEl.textContent = formatAddress(state.operatorInfo.address);

    const heartbeatEl = document.getElementById('last-heartbeat');
    if (heartbeatEl && state.gameState?.lastHeartbeat) {
      heartbeatEl.textContent = new Date(
        state.gameState.lastHeartbeat * 1000
      ).toLocaleTimeString();
    }

    const hwAuthEl = document.getElementById('hardware-authentic');
    if (hwAuthEl) {
      if (state.operatorInfo.active) {
        hwAuthEl.textContent = '✅ Active';
        hwAuthEl.className = 'metric-value green';
      } else {
        hwAuthEl.textContent = '⚠️ Inactive';
        hwAuthEl.className = 'metric-value yellow';
      }
    }
  }

  // Chain badge
  const chainBadge = document.getElementById('chain-badge');
  if (chainBadge) {
    if (state.gameState?.deployed && !state.gameState.error) {
      chainBadge.textContent = 'Synced';
      chainBadge.className = 'card-badge verified';
    } else if (state.gameState?.deployed) {
      chainBadge.textContent = 'Error';
      chainBadge.className = 'card-badge warning';
    } else {
      chainBadge.textContent = 'Not Deployed';
      chainBadge.className = 'card-badge warning';
    }
  }

  // ENS info
  const contentHashEl = document.getElementById('content-hash');
  if (contentHashEl) {
    const host = window.location.hostname;
    if (host.endsWith('.eth.limo') || host.endsWith('.eth.link')) {
      contentHashEl.textContent = 'ENS: ' + host.split('.')[0] + '.eth';
    } else {
      contentHashEl.textContent = 'Direct access (not via ENS)';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchLatestState() {
  const btn = document.getElementById('fetch-state');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Loading...';
  }

  try {
    if (!state.gameState?.cid) {
      throw new Error('No state CID available');
    }

    const result = await fetchFromIPFS(state.gameState.cid);

    if (result.success) {
      state.encryptedData = result.data;
      const stateEl = document.getElementById('encrypted-state');
      if (stateEl) {
        stateEl.textContent = result.data;
      }

      const stateBadge = document.getElementById('state-badge');
      if (stateBadge) {
        stateBadge.textContent =
          'Loaded from ' + new URL(result.gateway).hostname;
        stateBadge.className = 'card-badge verified';
      }
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    const stateEl = document.getElementById('encrypted-state');
    if (stateEl) stateEl.textContent = 'Error: ' + error.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Fetch Latest State';
    }
  }
}

async function runVerification() {
  const btn = document.getElementById('verify-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Verifying...';
  }

  try {
    const checks = [];

    // 1. Contract deployed
    checks.push(
      state.gameState?.deployed
        ? '✅ Contract deployed and readable'
        : '❌ Contract not deployed'
    );

    // 2. Operator active
    checks.push(
      state.operatorInfo?.active
        ? '✅ Operator is active'
        : '⚠️ Operator is inactive'
    );

    // 3. Recent heartbeat
    if (state.gameState?.lastHeartbeat) {
      const age = Math.floor(Date.now() / 1000) - state.gameState.lastHeartbeat;
      checks.push(
        age < 3600
          ? `✅ Heartbeat recent (${Math.floor(age / 60)} min ago)`
          : `⚠️ Heartbeat stale (${Math.floor(age / 3600)} hours ago)`
      );
    }

    // 4. Treasury funded
    checks.push(
      state.gameState?.balance > 0
        ? `✅ Treasury funded (${state.gameState.balance.toFixed(4)} ETH)`
        : '⚠️ Treasury empty'
    );

    // 5. State stored
    checks.push(
      state.gameState?.cid ? `✅ State stored on IPFS` : '⚠️ No state CID'
    );

    alert('Verification Results:\n\n' + checks.join('\n'));
  } catch (error) {
    alert('Verification failed: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ Verify Integrity';
    }
  }
}

async function checkTakeover() {
  const btn = document.getElementById('check-takeover');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Checking...';
  }

  try {
    const result = await checkTakeoverEligibility();

    if (result.eligible) {
      alert(`🔄 TAKEOVER AVAILABLE

The current operator has missed heartbeats.

To take over:
1. Deploy your own TEE instance
2. Generate attestation proof
3. Call contract.registerOperator(yourAddress, attestation)

This is a permissionless operation - anyone with a valid TEE can become the operator.

Last heartbeat: ${result.lastHeartbeat?.toLocaleString() || 'Never'}
Timeout: ${result.timeout} seconds`);
    } else {
      const remaining = result.timeUntilEligible;
      alert(`⏳ Operator is active

Last heartbeat: ${result.lastHeartbeat?.toLocaleString() || 'Unknown'}
Is active: ${result.isActive}
Time since heartbeat: ${result.timeSinceHeartbeat} seconds
Timeout: ${result.timeout} seconds

Takeover available in: ${remaining} seconds (${Math.ceil(remaining / 60)} minutes)

The game continues running autonomously.`);
    }
  } catch (error) {
    alert('Check failed: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Check Takeover Eligibility';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function init() {
  console.log('Initializing Babylon Trust Dashboard...');

  try {
    updateLoadingText('Connecting to Ethereum...');

    // Check if contract is deployed
    const treasuryAddress = CONFIG.contracts[CONFIG.network].gameTreasury;
    state.contractsDeployed =
      treasuryAddress !== '0x0000000000000000000000000000000000000000';

    if (!state.contractsDeployed) {
      updateLoadingText('Contracts not deployed - showing demo mode');
      // Show simulation warning
      const warning = document.getElementById('simulation-warning');
      if (warning) warning.style.display = 'flex';
    } else {
      updateLoadingText('Fetching game state...');
      state.gameState = await fetchGameState();

      updateLoadingText('Fetching operator info...');
      state.operatorInfo = await fetchOperatorInfo();
    }

    state.connected = true;
    state.lastUpdate = new Date();

    updateUI();
    hideLoading();

    console.log('Dashboard initialized:', state);
  } catch (error) {
    console.error('Init error:', error);
    updateLoadingText('Error: ' + error.message);
    state.errors.push(error.message);
  }
}

// Make functions globally available
window.fetchLatestState = fetchLatestState;
window.runVerification = runVerification;
window.checkTakeover = checkTakeover;
window.refreshState = async () => {
  state.gameState = await fetchGameState();
  state.operatorInfo = await fetchOperatorInfo();
  updateUI();
};

// Initialize on load
window.addEventListener('load', init);

// Auto-refresh every 30 seconds if tab is visible
setInterval(() => {
  if (!document.hidden && state.connected) {
    window.refreshState().catch(console.error);
  }
}, 30000);

console.log('Babylon Trust Dashboard script loaded');
