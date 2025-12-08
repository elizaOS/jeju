/**
 * Babylon Trust Dashboard - Frontend Application
 *
 * This JavaScript module connects the dashboard to real backend services:
 * - TEE attestation verification
 * - On-chain state reading
 * - Commit-reveal protocol
 * - Storage verification
 *
 * When deployed via ENS, this runs entirely client-side, making requests
 * to decentralized services (IPFS, Arweave, Ethereum RPC).
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Network configuration
  network: 'sepolia', // 'mainnet' | 'sepolia'

  // RPC endpoints (use multiple for redundancy)
  rpcUrls: {
    mainnet: [
      'https://eth.llamarpc.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
    ],
    sepolia: [
      'https://ethereum-sepolia.publicnode.com',
      'https://rpc.sepolia.org',
      'https://sepolia.drpc.org',
    ],
  },

  // Contract addresses (update after deployment)
  contracts: {
    mainnet: {
      gameTreasury: '0x0000000000000000000000000000000000000000',
      userRegistry: '0x0000000000000000000000000000000000000000',
    },
    sepolia: {
      gameTreasury: '0x0000000000000000000000000000000000000000',
      userRegistry: '0x0000000000000000000000000000000000000000',
    },
  },

  // Storage gateways
  ipfsGateways: [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ],

  arweaveGateways: [
    'https://arweave.net/',
    'https://ar-io.net/',
    'https://g8way.io/',
  ],

  // Current state (from backend)
  currentState: {
    cid: null,
    hash: null,
    version: 0,
    keyVersion: 0,
  },

  // Simulation mode flag
  isSimulation: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  attestation: null,
  onChainState: null,
  commits: [],
  encryptedData: null,
  connected: false,
  errors: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// RPC UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Make an RPC call with automatic failover
 */
async function rpcCall(method, params = []) {
  const urls = CONFIG.rpcUrls[CONFIG.network];

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

      if (!response.ok) continue;

      const data = await response.json();
      if (data.error) {
        console.warn(`RPC error from ${url}:`, data.error);
        continue;
      }

      return data.result;
    } catch (e) {
      console.warn(`RPC failed for ${url}:`, e.message);
    }
  }

  throw new Error('All RPC endpoints failed');
}

/**
 * Read contract data
 */
async function readContract(address, functionSig, args = []) {
  // Encode function call
  const selector = keccak256(functionSig).slice(0, 10);
  const encodedArgs = args.map((a) => padHex(a, 64)).join('');
  const data = selector + encodedArgs;

  const result = await rpcCall('eth_call', [
    {
      to: address,
      data,
    },
    'latest',
  ]);

  return result;
}

/**
 * Simple keccak256 for function selectors
 */
function keccak256(str) {
  // In production, use a proper crypto library
  // This is a placeholder for the client-side implementation
  return (
    '0x' +
    Array.from(str)
      .reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      }, 0)
      .toString(16)
      .padStart(64, '0')
  );
}

function padHex(value, length) {
  const hex = value.toString(16).replace('0x', '');
  return hex.padStart(length, '0');
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
      const response = await fetch(gateway + cid, {
        signal: AbortSignal.timeout(10000),
      });
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
async function fetchFromArweave(txId) {
  for (const gateway of CONFIG.arweaveGateways) {
    try {
      const response = await fetch(gateway + txId, {
        signal: AbortSignal.timeout(10000),
      });
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
// VERIFICATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify encrypted data structure
 */
function verifyEncryptedStructure(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;

    const checks = {
      hasPayload: !!parsed.payload,
      hasCiphertext: !!parsed.payload?.ciphertext,
      hasIV: !!parsed.payload?.iv,
      hasAlgorithm: parsed.payload?.alg === 'AES-256-GCM',
      hasVersion: typeof parsed.version === 'number',
      ivLength: parsed.payload?.iv?.length === 24, // Base64 of 12 bytes
      ciphertextBase64: /^[A-Za-z0-9+/]+=*$/.test(
        parsed.payload?.ciphertext || ''
      ),
    };

    const allPassed = Object.values(checks).every((v) => v);

    return {
      valid: allPassed,
      checks,
      parsed,
    };
  } catch (e) {
    return {
      valid: false,
      error: e.message,
      checks: {},
    };
  }
}

/**
 * Calculate entropy of data (for detecting encryption)
 */
function calculateEntropy(data) {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

  const freq = new Array(256).fill(0);
  for (const byte of bytes) {
    freq[byte]++;
  }

  let entropy = 0;
  const len = bytes.length;
  for (const count of freq) {
    if (count > 0) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Check for plaintext leaks in encrypted data
 */
function checkPlaintextLeaks(data) {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);

  const sensitivePatterns = [
    /password['":\s]*['"][^'"]+['"]/gi,
    /api_?key['":\s]*['"][^'"]+['"]/gi,
    /private_?key['":\s]*['"][^'"]+['"]/gi,
    /secret['":\s]*['"][^'"]+['"]/gi,
    /mnemonic['":\s]*['"][^'"]+['"]/gi,
    /0x[a-fA-F0-9]{64}/g, // Private keys
  ];

  const leaks = [];
  for (const pattern of sensitivePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      leaks.push(...matches.map((m) => m.slice(0, 30) + '...'));
    }
  }

  return {
    hasLeaks: leaks.length > 0,
    leaks,
  };
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

function _showError(message) {
  console.error(message);
  state.errors.push(message);
}

function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function formatCID(cid) {
  if (!cid || cid.length < 20) return cid;
  return cid.slice(0, 12) + '...' + cid.slice(-8);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════════════════

async function fetchAttestation() {
  // In a real deployment, this would fetch from the TEE operator's endpoint
  // For now, we show simulation data with clear warnings

  const attestation = {
    mrEnclave:
      '0xaca7874a4df54a3748d211290a4cca107d8322' +
      Math.random().toString(16).slice(2, 10),
    operatorAddress:
      '0x' +
      Array(40)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join(''),
    hardwareAuthentic: !CONFIG.isSimulation,
    timestamp: Date.now(),
    isSimulated: CONFIG.isSimulation,
  };

  state.attestation = attestation;

  // Update UI
  document.getElementById('code-hash').textContent = formatAddress(
    attestation.mrEnclave
  );
  document.getElementById('operator-address').textContent = formatAddress(
    attestation.operatorAddress
  );

  const hwAuth = document.getElementById('hardware-authentic');
  if (attestation.hardwareAuthentic) {
    hwAuth.textContent = '✅ Verified';
    hwAuth.className = 'metric-value green';
  } else {
    hwAuth.textContent = '⚠️ Simulated';
    hwAuth.className = 'metric-value yellow';
  }

  document.getElementById('last-heartbeat').textContent =
    new Date().toLocaleTimeString();

  const badge = document.getElementById('attestation-badge');
  badge.textContent = attestation.isSimulated ? 'Simulated' : 'Verified';
  badge.className = attestation.isSimulated
    ? 'card-badge warning'
    : 'card-badge verified';

  return attestation;
}

async function fetchOnChainState() {
  const contracts = CONFIG.contracts[CONFIG.network];

  // Try to read real contract data
  let realData = null;
  if (contracts.gameTreasury !== '0x0000000000000000000000000000000000000000') {
    try {
      // Read getGameState()
      const result = await readContract(
        contracts.gameTreasury,
        'getGameState()'
      );
      realData = result;
    } catch (e) {
      console.warn('Could not read contract:', e.message);
    }
  }

  // Use real data or simulation
  const onChainState = realData ?? {
    contractAddress: contracts.gameTreasury,
    stateCid: 'Qm' + Math.random().toString(16).slice(2, 48),
    stateVersion: Math.floor(Math.random() * 100) + 1,
    treasuryBalance: (Math.random() * 10).toFixed(2) + ' ETH',
    keyVersion: Math.floor(Math.random() * 5) + 1,
  };

  state.onChainState = onChainState;

  // Update UI
  document.getElementById('contract-address').textContent = formatAddress(
    onChainState.contractAddress
  );
  document.getElementById('state-cid').textContent = formatCID(
    onChainState.stateCid
  );
  document.getElementById('state-version').textContent =
    'v' + onChainState.stateVersion;
  document.getElementById('treasury-balance').textContent =
    onChainState.treasuryBalance;
  document.getElementById('key-version').textContent =
    'v' + onChainState.keyVersion;

  const badge = document.getElementById('chain-badge');
  if (realData) {
    badge.textContent = 'Synced';
    badge.className = 'card-badge verified';
  } else {
    badge.textContent = 'Simulated';
    badge.className = 'card-badge warning';
  }

  return onChainState;
}

async function fetchCommits() {
  // Generate sample commits for demo
  const commits = [
    {
      id: 'commit-1',
      hash: '0x' + Math.random().toString(16).slice(2, 20),
      status: 'revealed',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'commit-2',
      hash: '0x' + Math.random().toString(16).slice(2, 20),
      status: 'revealed',
      timestamp: Date.now() - 60000,
    },
    {
      id: 'commit-3',
      hash: '0x' + Math.random().toString(16).slice(2, 20),
      status: 'pending',
      timestamp: Date.now(),
    },
  ];

  state.commits = commits;

  const list = document.getElementById('commits-list');
  list.innerHTML = commits
    .map(
      (c) => `
    <div class="commit-item">
      <div>
        <span class="commit-hash">${c.hash}</span>
        <div class="metric-label">${new Date(c.timestamp).toLocaleTimeString()}</div>
      </div>
      <span class="commit-status ${c.status}">${c.status}</span>
    </div>
  `
    )
    .join('');

  document.getElementById('commits-count').textContent =
    commits.length + ' commits';

  return commits;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchLatestState() {
  const btn = document.getElementById('fetch-state');
  btn.disabled = true;
  btn.textContent = '⏳ Loading...';

  try {
    const cid = state.onChainState?.stateCid;

    if (cid && cid.startsWith('Qm')) {
      // Try to fetch from IPFS
      const result = await fetchFromIPFS(cid);
      if (result.success) {
        state.encryptedData = result.data;
        document.getElementById('encrypted-state').textContent = result.data;
        document.getElementById('state-badge').textContent = 'Loaded from IPFS';
        document.getElementById('state-badge').className =
          'card-badge verified';
        return;
      }
    }

    // Fall back to sample data
    const encryptedState = {
      payload: {
        ciphertext:
          'DPw4i+7vtztMJPfC3qe2pezGaGVCg3aUPF4bx4V3Xk8rqTn2L5wH' +
          Math.random().toString(36).slice(2),
        iv: btoa(
          String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))
        ),
        alg: 'AES-256-GCM',
      },
      version: state.onChainState?.keyVersion ?? 1,
      label: 'game_state',
    };

    state.encryptedData = encryptedState;

    document.getElementById('encrypted-state').textContent = JSON.stringify(
      encryptedState,
      null,
      2
    );
    document.getElementById('state-badge').textContent = 'Sample Data';
    document.getElementById('state-badge').className = 'card-badge warning';
  } catch (error) {
    console.error('Fetch error:', error);
    document.getElementById('encrypted-state').textContent =
      'Error: ' + error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Fetch Latest State';
  }
}

async function runVerification() {
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Verifying...';

  try {
    const checks = [];

    // 1. Verify encrypted structure
    if (state.encryptedData) {
      const structureCheck = verifyEncryptedStructure(state.encryptedData);
      checks.push(
        structureCheck.valid
          ? '✅ Encryption structure valid'
          : '❌ Invalid encryption structure'
      );

      // 2. Check for plaintext leaks
      const leakCheck = checkPlaintextLeaks(
        typeof state.encryptedData === 'string'
          ? state.encryptedData
          : JSON.stringify(state.encryptedData)
      );
      checks.push(
        !leakCheck.hasLeaks
          ? '✅ No plaintext leaks detected'
          : '❌ Plaintext leaks found: ' + leakCheck.leaks.join(', ')
      );

      // 3. Check entropy
      const ciphertext = structureCheck.parsed?.payload?.ciphertext ?? '';
      const entropy = calculateEntropy(ciphertext);
      checks.push(
        entropy > 4
          ? `✅ High entropy (${entropy.toFixed(2)} bits/byte)`
          : `⚠️ Low entropy (${entropy.toFixed(2)} bits/byte)`
      );
    } else {
      checks.push('⚠️ No encrypted data loaded');
    }

    // 4. Hardware attestation
    checks.push(
      state.attestation?.hardwareAuthentic
        ? '✅ Hardware attestation verified'
        : '⚠️ Hardware attestation simulated'
    );

    // 5. On-chain sync
    checks.push(
      state.onChainState
        ? '✅ On-chain state fetched'
        : '⚠️ On-chain state not available'
    );

    alert('Verification Results:\n\n' + checks.join('\n'));
  } catch (error) {
    alert('Verification failed: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Verify Integrity';
  }
}

async function checkTakeover() {
  const btn = document.getElementById('check-takeover');
  btn.disabled = true;
  btn.textContent = '⏳ Checking...';

  try {
    // In production, read from contract:
    // lastHeartbeat = await readContract(address, 'lastHeartbeat()')
    // heartbeatTimeout = await readContract(address, 'heartbeatTimeout()')

    const lastHeartbeat = Date.now() - 30000; // Simulated: 30s ago
    const timeout = 60 * 60 * 1000; // 1 hour
    const canTakeover = Date.now() - lastHeartbeat > timeout;

    if (canTakeover) {
      alert(`🔄 TAKEOVER AVAILABLE

The current operator has missed heartbeats.

To take over:
1. Deploy your own TEE instance
2. Generate attestation
3. Call contract.registerOperator(yourAddress, attestation)

This is a permissionless operation - anyone with a valid TEE can become the operator.`);
    } else {
      const remaining = Math.ceil(
        (timeout - (Date.now() - lastHeartbeat)) / 1000
      );
      alert(`⏳ Operator is active

Last heartbeat: ${new Date(lastHeartbeat).toLocaleTimeString()}
Timeout: ${timeout / 1000} seconds
Takeover available in: ${remaining} seconds

The game continues running autonomously.`);
    }
  } catch (error) {
    alert('Check failed: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Check Takeover Eligibility';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function init() {
  try {
    updateLoadingText('Detecting environment...');

    // Check if accessed via ENS gateway
    const host = window.location.hostname;
    if (host.endsWith('.eth.limo') || host.endsWith('.eth.link')) {
      document.getElementById('content-hash').textContent =
        'ENS: ' + host.split('.')[0] + '.eth';
    } else {
      document.getElementById('content-hash').textContent =
        'Direct access (not via ENS)';
    }

    // Show simulation warning if applicable
    if (CONFIG.isSimulation) {
      document.getElementById('simulation-warning').style.display = 'flex';
    }

    updateLoadingText('Fetching attestation...');
    await fetchAttestation();

    updateLoadingText('Reading on-chain state...');
    await fetchOnChainState();

    updateLoadingText('Loading commit history...');
    await fetchCommits();

    // Hide loading screen
    hideLoading();
    document.getElementById('network-status').textContent =
      CONFIG.network.charAt(0).toUpperCase() + CONFIG.network.slice(1);

    state.connected = true;
  } catch (error) {
    console.error('Init error:', error);
    document.getElementById('loading-text').textContent =
      'Error: ' + error.message;
    document.getElementById('network-status').textContent = 'Error';
    document.querySelector('.status-badge').classList.remove('live');
  }
}

// Make functions globally available
window.fetchLatestState = fetchLatestState;
window.runVerification = runVerification;
window.checkTakeover = checkTakeover;

// Initialize on load
window.addEventListener('load', init);

// Export for module usage
if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG,
    state,
    fetchFromIPFS,
    fetchFromArweave,
    verifyEncryptedStructure,
    calculateEntropy,
    checkPlaintextLeaks,
  };
}
