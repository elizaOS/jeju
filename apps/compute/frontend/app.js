/**
 * Jeju Compute Marketplace - Frontend Application
 * Handles wallet connection, provider browsing, rental management
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  network: 'sepolia',
  chainId: 11155111, // Sepolia
  rpcUrl: 'https://sepolia.ethereum.org',
  contracts: {
    registry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    rental: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    inference: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    ledger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
  gatewayUrl: 'http://localhost:4009',
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  connected: false,
  address: null,
  provider: null,
  signer: null,
  providers: [],
  rentals: [],
  models: [],
  selectedProvider: null,
  selectedRentalId: null,
  selectedRating: 0,
  filters: {
    gpuType: '',
    minMemory: 0,
    maxPrice: '',
    features: '',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// WALLET CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast('Please install MetaMask', 'error');
    return;
  }

  const btn = document.getElementById('connect-wallet');
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    state.address = accounts[0];
    state.connected = true;

    // Switch to correct network
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + CONFIG.chainId.toString(16) }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + CONFIG.chainId.toString(16),
            chainName: 'Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [CONFIG.rpcUrl],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      }
    }

    updateWalletUI();
    showToast('Wallet connected', 'success');
    
    // Refresh data
    await loadUserRentals();
    
  } catch (error) {
    console.error('Connection error:', error);
    showToast('Failed to connect: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔗 Connect Wallet';
  }
}

function disconnectWallet() {
  state.connected = false;
  state.address = null;
  state.rentals = [];
  updateWalletUI();
  showToast('Wallet disconnected', 'success');
}

function updateWalletUI() {
  const connectBtn = document.getElementById('connect-wallet');
  const walletInfo = document.getElementById('wallet-info');
  const addressEl = document.getElementById('wallet-address');
  const createBtn = document.getElementById('create-rental-btn');

  if (state.connected) {
    connectBtn.style.display = 'none';
    walletInfo.style.display = 'flex';
    addressEl.textContent = formatAddress(state.address);
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Rental';
    }
  } else {
    connectBtn.style.display = 'flex';
    walletInfo.style.display = 'none';
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = 'Connect Wallet First';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadProviders() {
  const grid = document.getElementById('provider-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/providers`);
    if (!response.ok) throw new Error('Failed to fetch providers');
    
    const data = await response.json();
    state.providers = data.providers || [];

    // Fetch additional provider details (reputation, resources)
    for (let i = 0; i < state.providers.length; i++) {
      try {
        const detailResponse = await fetch(`${CONFIG.gatewayUrl}/v1/providers/${state.providers[i].address}`);
        if (detailResponse.ok) {
          const detail = await detailResponse.json();
          state.providers[i] = { ...state.providers[i], ...detail };
        }
      } catch {
        // Continue with basic provider info
      }
    }

    // Update stats
    document.getElementById('stat-providers').textContent = state.providers.length;
    document.getElementById('stat-avg-price').textContent = calculateAvgPrice(state.providers);
    document.getElementById('stat-staked').textContent = calculateTotalStaked(state.providers);
    document.getElementById('stat-gpu-hours').textContent = '—'; // Real value from analytics

    renderProviders();
  } catch (error) {
    console.error('Load providers error:', error);
    // Show empty state instead of mock data
    state.providers = [];
    document.getElementById('stat-providers').textContent = '0';
    document.getElementById('stat-avg-price').textContent = '—';
    document.getElementById('stat-staked').textContent = '—';
    document.getElementById('stat-gpu-hours').textContent = '—';
    
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Unable to load providers</div>
        <p>Gateway at ${CONFIG.gatewayUrl} is not responding. Check your connection.</p>
        <button class="btn btn-primary" onclick="loadProviders()">Retry</button>
      </div>
    `;
  }
}

function renderProviders() {
  const grid = document.getElementById('provider-grid');
  let filtered = state.providers;

  // Apply filters
  if (state.filters.gpuType) {
    filtered = filtered.filter(p => p.resources?.gpuType === state.filters.gpuType);
  }
  if (state.filters.minMemory > 0) {
    filtered = filtered.filter(p => (p.resources?.gpuMemoryGb || 0) >= state.filters.minMemory);
  }
  if (state.filters.features === 'ssh') {
    filtered = filtered.filter(p => p.sshEnabled);
  } else if (state.filters.features === 'docker') {
    filtered = filtered.filter(p => p.dockerEnabled);
  } else if (state.filters.features === 'tee') {
    filtered = filtered.filter(p => p.resources?.teeSupported);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No providers match your filters</div>
        <p>Try adjusting your search criteria</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(provider => `
    <div class="provider-card" data-address="${provider.address}" data-testid="provider-card-${provider.address.slice(0, 8)}">
      <div class="provider-header">
        <div>
          <div class="provider-name">${provider.name}</div>
          <div class="provider-address">${formatAddress(provider.address)}</div>
        </div>
        <span class="provider-status ${provider.available ? 'available' : 'busy'}">
          ${provider.available ? '● Available' : '● Busy'}
        </span>
      </div>
      
      <div class="provider-specs">
        <div class="spec-item">
          <span class="spec-label">GPU</span>
          <span class="spec-value gpu">${formatGpuType(provider.resources?.gpuType)} × ${provider.resources?.gpuCount || 1}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">VRAM</span>
          <span class="spec-value">${provider.resources?.gpuMemoryGb || 0} GB</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">CPU</span>
          <span class="spec-value">${provider.resources?.cpuCores || 0} cores</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">RAM</span>
          <span class="spec-value">${provider.resources?.memoryGb || 0} GB</span>
        </div>
      </div>
      
      <div class="provider-tags">
        ${provider.sshEnabled ? '<span class="provider-tag ssh">SSH</span>' : ''}
        ${provider.dockerEnabled ? '<span class="provider-tag docker">Docker</span>' : ''}
        ${provider.resources?.teeSupported ? '<span class="provider-tag tee">TEE</span>' : ''}
      </div>
      
      <div class="provider-footer">
        <div class="provider-price">
          ${provider.pricing?.pricePerHour || '0.00'} <span>ETH/hr</span>
        </div>
        <div class="provider-rating">
          ★ ${provider.reputation?.avgRating || '4.5'} (${provider.reputation?.ratingCount || 0})
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.provider-card').forEach(card => {
    card.addEventListener('click', () => openRentalModal(card.dataset.address));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RENTALS
// ═══════════════════════════════════════════════════════════════════════════

async function loadUserRentals() {
  if (!state.connected) return;

  const list = document.getElementById('rentals-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/rentals?user=${state.address}`);
    if (!response.ok) throw new Error('Failed to fetch rentals');
    
    const data = await response.json();
    state.rentals = data.rentals || [];
    renderRentals();
  } catch (error) {
    console.error('Load rentals error:', error);
    // Show empty state instead of mock data
    state.rentals = [];
    const noRentals = document.getElementById('no-rentals');
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Unable to load rentals</div>
        <p>Check gateway connection and try again.</p>
        <button class="btn btn-primary" onclick="loadUserRentals()">Retry</button>
      </div>
    `;
    if (noRentals) noRentals.style.display = 'none';
  }
}

function renderRentals() {
  const list = document.getElementById('rentals-list');
  const noRentals = document.getElementById('no-rentals');

  if (state.rentals.length === 0) {
    list.innerHTML = '';
    noRentals.style.display = 'block';
    return;
  }

  noRentals.style.display = 'none';
  list.innerHTML = state.rentals.map(rental => `
    <div class="rental-card" data-rental-id="${rental.rentalId}" data-testid="rental-card-${rental.rentalId.slice(0, 10)}">
      <div class="rental-header">
        <div>
          <div class="rental-id">${rental.rentalId.slice(0, 18)}...</div>
          <div style="color: var(--text-muted); font-size: 0.85rem;">${rental.providerName || formatAddress(rental.provider)}</div>
        </div>
        <span class="rental-status ${rental.status.toLowerCase()}">${rental.status}</span>
      </div>
      
      <div class="rental-details">
        <div class="rental-detail">
          <span class="rental-detail-label">Started</span>
          <span class="rental-detail-value">${rental.startTime ? new Date(rental.startTime).toLocaleString() : 'Pending'}</span>
        </div>
        <div class="rental-detail">
          <span class="rental-detail-label">Ends</span>
          <span class="rental-detail-value">${rental.endTime ? new Date(rental.endTime).toLocaleString() : 'N/A'}</span>
        </div>
        <div class="rental-detail">
          <span class="rental-detail-label">Total Cost</span>
          <span class="rental-detail-value">${rental.totalCost} ETH</span>
        </div>
        <div class="rental-detail">
          <span class="rental-detail-label">Container</span>
          <span class="rental-detail-value">${rental.containerImage || 'None'}</span>
        </div>
      </div>

      ${rental.status === 'ACTIVE' && rental.sshHost ? `
        <div class="ssh-terminal" data-testid="ssh-terminal-${rental.rentalId.slice(0, 10)}">
          <code>ssh -p ${rental.sshPort} user@${rental.sshHost}</code>
        </div>
      ` : ''}
      
      <div class="rental-actions" data-testid="rental-actions-${rental.rentalId.slice(0, 10)}">
        ${rental.status === 'ACTIVE' ? `
          <button class="btn btn-secondary" onclick="extendRental('${rental.rentalId}')" data-testid="extend-rental-btn-${rental.rentalId.slice(0, 10)}">
            ⏰ Extend
          </button>
          <button class="btn btn-danger" onclick="cancelRental('${rental.rentalId}')" data-testid="cancel-rental-btn-${rental.rentalId.slice(0, 10)}">
            ✕ Cancel
          </button>
        ` : ''}
        ${rental.status === 'COMPLETED' ? `
          <button class="btn btn-primary" onclick="openRatingModal('${rental.rentalId}')" data-testid="rate-rental-btn-${rental.rentalId.slice(0, 10)}">
            ★ Rate
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════

function openRentalModal(providerAddress) {
  state.selectedProvider = state.providers.find(p => p.address === providerAddress);
  if (!state.selectedProvider) return;

  const modal = document.getElementById('rental-modal');
  const info = document.getElementById('selected-provider-info');
  
  info.innerHTML = `
    <div class="provider-specs" style="margin-bottom: 1.5rem;">
      <div class="spec-item">
        <span class="spec-label">Provider</span>
        <span class="spec-value">${state.selectedProvider.name}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">GPU</span>
        <span class="spec-value gpu">${formatGpuType(state.selectedProvider.resources?.gpuType)}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Price/Hour</span>
        <span class="spec-value">${state.selectedProvider.pricing?.pricePerHour} ETH</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Status</span>
        <span class="spec-value" style="color: var(--accent-green);">Available</span>
      </div>
    </div>
  `;

  updateCostBreakdown();
  modal.classList.add('active');
  // Prevent body scroll on mobile when modal is open
  document.body.style.overflow = 'hidden';
}

function closeRentalModal() {
  document.getElementById('rental-modal').classList.remove('active');
  state.selectedProvider = null;
  // Restore body scroll
  document.body.style.overflow = '';
}

function updateCostBreakdown() {
  if (!state.selectedProvider) return;
  
  const duration = parseInt(document.getElementById('rental-duration').value) || 1;
  const pricePerHour = parseFloat(state.selectedProvider.pricing?.pricePerHour) || 0;
  const total = (pricePerHour * duration).toFixed(4);

  document.getElementById('cost-per-hour').textContent = pricePerHour + ' ETH';
  document.getElementById('cost-duration').textContent = duration + ' hour' + (duration > 1 ? 's' : '');
  document.getElementById('cost-total').textContent = total + ' ETH';
}

function openRatingModal(rentalId) {
  state.selectedRentalId = rentalId;
  state.selectedRating = 0;
  updateRatingStars();
  document.getElementById('rating-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeRatingModal() {
  document.getElementById('rating-modal').classList.remove('active');
  state.selectedRentalId = null;
  state.selectedRating = 0;
  document.body.style.overflow = '';
}

function updateRatingStars() {
  document.querySelectorAll('.rating-star').forEach((star, i) => {
    star.classList.toggle('active', i < state.selectedRating);
  });
  document.getElementById('submit-rating-btn').disabled = state.selectedRating === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function createRental(e) {
  e.preventDefault();
  if (!state.connected || !state.selectedProvider) return;

  const btn = document.getElementById('create-rental-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Creating...';

  try {
    const duration = parseInt(document.getElementById('rental-duration').value);
    const sshKey = document.getElementById('rental-ssh-key').value;
    const dockerImage = document.getElementById('rental-docker-image').value;
    const startupScript = document.getElementById('rental-startup-script').value;

    // Get auth headers
    const authHeaders = await generateAuthHeaders();

    // Request transaction data from gateway
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/rentals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        provider: state.selectedProvider.address,
        duration,
        sshPublicKey: sshKey,
        containerImage: dockerImage,
        startupScript,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to prepare rental');
    }

    const { transaction, estimatedCost } = await response.json();
    
    showToast(`Creating rental (${(Number(estimatedCost) / 1e18).toFixed(6)} ETH)...`, 'success');

    // Execute transaction via MetaMask
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.address,
        to: transaction.to,
        value: '0x' + BigInt(transaction.value).toString(16),
        data: transaction.data,
      }],
    });

    showToast('Transaction submitted: ' + txHash.slice(0, 10) + '...', 'success');

    // Wait for confirmation
    await waitForTransaction(txHash);

    closeRentalModal();
    await loadUserRentals();
    switchTab('rentals');
    showToast('Rental created successfully!', 'success');

  } catch (error) {
    console.error('Create rental error:', error);
    showToast('Failed to create rental: ' + error.message, 'error');
  } finally {
    btn.disabled = !state.connected;
    btn.textContent = state.connected ? 'Create Rental' : 'Connect Wallet First';
  }
}

// Generate auth headers for gateway requests
async function generateAuthHeaders() {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const message = `${state.address}:${nonce}:${timestamp}`;
  
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, state.address],
  });

  return {
    'x-jeju-address': state.address,
    'x-jeju-nonce': nonce,
    'x-jeju-timestamp': timestamp,
    'x-jeju-signature': signature,
  };
}

// Wait for transaction confirmation
async function waitForTransaction(txHash) {
  return new Promise((resolve, reject) => {
    const checkReceipt = async () => {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      
      if (receipt) {
        if (receipt.status === '0x1') {
          resolve(receipt);
        } else {
          reject(new Error('Transaction failed'));
        }
      } else {
        setTimeout(checkReceipt, 2000);
      }
    };
    checkReceipt();
  });
}

async function extendRental(rentalId) {
  if (!state.connected) return;
  
  const hours = prompt('Enter additional hours to extend:');
  if (!hours || isNaN(hours)) return;

  try {
    const authHeaders = await generateAuthHeaders();
    
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/rentals/${rentalId}/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ additionalHours: parseInt(hours) }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extend rental');
    }

    const { transaction, estimatedCost } = await response.json();
    
    showToast(`Extending rental (${(Number(estimatedCost) / 1e18).toFixed(6)} ETH)...`, 'success');

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.address,
        to: transaction.to,
        value: '0x' + BigInt(transaction.value).toString(16),
        data: transaction.data,
      }],
    });

    await waitForTransaction(txHash);
    showToast('Rental extended successfully!', 'success');
    await loadUserRentals();
    
  } catch (error) {
    console.error('Extend rental error:', error);
    showToast('Failed to extend rental: ' + error.message, 'error');
  }
}

async function cancelRental(rentalId) {
  if (!state.connected) return;
  
  if (!confirm('Are you sure you want to cancel this rental? You may receive a partial refund.')) return;

  try {
    const authHeaders = await generateAuthHeaders();
    
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/rentals/${rentalId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel rental');
    }

    const { transaction } = await response.json();
    
    showToast('Cancelling rental...', 'success');

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.address,
        to: transaction.to,
        value: '0x0',
        data: transaction.data,
      }],
    });

    await waitForTransaction(txHash);
    showToast('Rental cancelled. Refund initiated.', 'success');
    await loadUserRentals();
    
  } catch (error) {
    console.error('Cancel rental error:', error);
    showToast('Failed to cancel rental: ' + error.message, 'error');
  }
}

async function submitRating() {
  if (!state.connected || !state.selectedRentalId || state.selectedRating === 0) return;

  const btn = document.getElementById('submit-rating-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Submitting...';

  try {
    const review = document.getElementById('rating-review').value;
    const authHeaders = await generateAuthHeaders();
    
    const response = await fetch(`${CONFIG.gatewayUrl}/v1/rentals/${state.selectedRentalId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ rating: state.selectedRating, review }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit rating');
    }

    const { transaction } = await response.json();
    
    showToast(`Submitting ${state.selectedRating}-star rating...`, 'success');

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.address,
        to: transaction.to,
        value: '0x0',
        data: transaction.data,
      }],
    });

    await waitForTransaction(txHash);
    closeRatingModal();
    showToast('Rating submitted successfully!', 'success');

  } catch (error) {
    console.error('Submit rating error:', error);
    showToast('Failed to submit rating: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Rating';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function formatAddress(address) {
  if (!address || address.length < 10) return address || '';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function formatGpuType(type) {
  const map = {
    'NVIDIA_RTX_4090': 'RTX 4090',
    'NVIDIA_A100_40GB': 'A100 40GB',
    'NVIDIA_A100_80GB': 'A100 80GB',
    'NVIDIA_H100': 'H100',
    'NVIDIA_H200': 'H200',
    'AMD_MI300X': 'MI300X',
  };
  return map[type] || type || 'Unknown';
}

function calculateAvgPrice(providers) {
  if (providers.length === 0) return '0.00 ETH';
  const total = providers.reduce((sum, p) => sum + parseFloat(p.pricing?.pricePerHour || 0), 0);
  return (total / providers.length).toFixed(4) + ' ETH';
}

function calculateTotalStaked(providers) {
  const total = providers.reduce((sum, p) => sum + parseFloat(p.stake || 0), 0);
  return total.toFixed(2) + ' ETH';
}

function switchTab(tabName) {
  // Update nav
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === 'page-' + tabName);
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function applyFilters() {
  state.filters.gpuType = document.getElementById('filter-gpu').value;
  state.filters.minMemory = parseInt(document.getElementById('filter-memory').value) || 0;
  state.filters.maxPrice = document.getElementById('filter-price').value;
  state.filters.features = document.getElementById('filter-features').value;
  renderProviders();
}

function resetFilters() {
  document.getElementById('filter-gpu').value = '';
  document.getElementById('filter-memory').value = '';
  document.getElementById('filter-price').value = '';
  document.getElementById('filter-features').value = '';
  state.filters = { gpuType: '', minMemory: 0, maxPrice: '', features: '' };
  renderProviders();
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Wallet
  document.getElementById('connect-wallet').addEventListener('click', connectWallet);
  document.getElementById('disconnect-wallet').addEventListener('click', disconnectWallet);

  // Navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Filters
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('reset-filters').addEventListener('click', resetFilters);

  // Rental form
  document.getElementById('rental-form').addEventListener('submit', createRental);
  document.getElementById('rental-duration').addEventListener('input', updateCostBreakdown);

  // Rating - support both click and touch
  document.querySelectorAll('.rating-star').forEach(star => {
    const handleRating = (e) => {
      e.preventDefault();
      state.selectedRating = parseInt(star.dataset.rating);
      updateRatingStars();
    };
    star.addEventListener('click', handleRating);
    star.addEventListener('touchend', handleRating);
  });
  document.getElementById('submit-rating-btn').addEventListener('click', submitRating);

  // Close modals on backdrop click
  document.getElementById('rental-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeRentalModal();
    }
  });
  document.getElementById('rating-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeRatingModal();
    }
  });

  // Handle escape key for modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('rental-modal').classList.contains('active')) {
        closeRentalModal();
      }
      if (document.getElementById('rating-modal').classList.contains('active')) {
        closeRatingModal();
      }
    }
  });

  // Listen for account changes
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        state.address = accounts[0];
        updateWalletUI();
        loadUserRentals();
      }
    });
  }

  // Load initial data
  loadProviders();
});

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { state, CONFIG, connectWallet, loadProviders, switchTab };
}
