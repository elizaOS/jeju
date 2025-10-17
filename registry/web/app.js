// ERC-8004 Trustless Agents Web Interface
// Connects to deployed contracts on multiple testnets

class TrustlessAgentsApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.selectedNetwork = null;
        this.contracts = {};
        
        // Network configurations - contracts will be loaded from config.js
        this.networks = {
            sepolia: {
                name: "Ethereum Sepolia",
                chainId: 11155111,
                rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
                explorer: "https://sepolia.etherscan.io",
                contracts: {}
            },
            base_sepolia: {
                name: "Base Sepolia",
                chainId: 84532,
                rpcUrl: "https://sepolia.base.org",
                explorer: "https://sepolia.basescan.org",
                contracts: {
                    identityRegistry: "",
                    reputationRegistry: "",
                    validationRegistry: ""
                }
            },
            arbitrum_sepolia: {
                name: "Arbitrum Sepolia",
                chainId: 421614,
                rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
                explorer: "https://sepolia.arbiscan.io",
                contracts: {
                    identityRegistry: "",
                    reputationRegistry: "",
                    validationRegistry: ""
                }
            },
            optimism_sepolia: {
                name: "Optimism Sepolia",
                chainId: 11155420,
                rpcUrl: "https://sepolia.optimism.io",
                explorer: "https://sepolia-optimistic.etherscan.io",
                contracts: {
                    identityRegistry: "",
                    reputationRegistry: "",
                    validationRegistry: ""
                }
            }
        };

                 // Contract ABI (correct return types matching AgentInfo struct)
         this.identityRegistryABI = [
             "function newAgent(string memory agentDomain, address agentAddress) external returns (uint256)",
             "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, string agentDomain, address agentAddress))",
             "function getAgentCount() external view returns (uint256)",
             "function resolveByDomain(string memory agentDomain) external view returns (tuple(uint256 agentId, string agentDomain, address agentAddress))",
             "function resolveByAddress(address agentAddress) external view returns (tuple(uint256 agentId, string agentDomain, address agentAddress))",
             "event AgentRegistered(uint256 indexed agentId, string agentDomain, address indexed agentAddress)"
         ];

        // Discovery state
        this.discoveredAgents = [];
        this.filteredAgents = [];
        this.currentTab = 'discovery';
        this.isDiscovering = false;

        this.loadContractAddresses();
        this.init();
    }

    loadContractAddresses() {
        // Load contract addresses from config.js
        if (window.CONTRACT_ADDRESSES) {
            console.log('📋 Loading contract addresses from config...');
            Object.entries(window.CONTRACT_ADDRESSES).forEach(([networkKey, addresses]) => {
                if (this.networks[networkKey]) {
                    this.networks[networkKey].contracts = addresses;
                    console.log(`✅ Loaded contracts for ${networkKey}:`, addresses);
                }
            });
        } else {
            console.warn('⚠️ CONTRACT_ADDRESSES not found in window object');
        }
    }

    async init() {
        this.setupEventListeners();
        this.renderNetworkSelector();
        this.setupTabNavigation();
        await this.checkWalletConnection();
        
        // Don't auto-discover - let users choose their exploration method
        console.log('🎯 ERC-8004 Agent Explorer ready - choose Quick Search or Discover All');
    }

         setupEventListeners() {
         // Check if elements exist before adding listeners
         const connectWalletBtn = document.getElementById('connectWallet');
         const registrationForm = document.getElementById('registrationForm');
         const lookupBtn = document.getElementById('lookupBtn');
         const refreshAgentsBtn = document.getElementById('refreshAgentsBtn');
         const agentAddress = document.getElementById('agentAddress');
         const disconnectBtn = document.getElementById('disconnectWallet');

         if (connectWalletBtn) {
             connectWalletBtn.addEventListener('click', () => this.connectWallet());
         }
         
         if (registrationForm) {
             registrationForm.addEventListener('submit', (e) => this.handleRegistration(e));
         }
         
         if (lookupBtn) {
             lookupBtn.addEventListener('click', () => this.handleLookup());
         }

         if (refreshAgentsBtn) {
             refreshAgentsBtn.addEventListener('click', () => {
                 console.log('🔄 Full discovery triggered');
                 this.discoverAllAgents();
             });
         }

         const quickSearchBtn = document.getElementById('quickSearchBtn');
         if (quickSearchBtn) {
             quickSearchBtn.addEventListener('click', () => this.performQuickSearch());
         }


         if (disconnectBtn) {
             disconnectBtn.addEventListener('click', () => this.disconnectWallet());
         }
         
         // Auto-fill agent address with connected wallet
         if (agentAddress) {
             agentAddress.addEventListener('focus', () => {
                 if (this.signer && !agentAddress.value) {
                     this.signer.getAddress().then(address => {
                         agentAddress.value = address;
                     });
                 }
             });
         }

         // Discovery filters
         const networkFilter = document.getElementById('networkFilter');
         const aiModelFilter = document.getElementById('aiModelFilter');
         const trustModelFilter = document.getElementById('trustModelFilter');
         const searchFilter = document.getElementById('searchFilter');

         if (networkFilter) {
             networkFilter.addEventListener('change', () => this.applyFilters());
         }
         if (aiModelFilter) {
             aiModelFilter.addEventListener('change', () => this.applyFilters());
         }
         if (trustModelFilter) {
             trustModelFilter.addEventListener('change', () => this.applyFilters());
         }
         if (searchFilter) {
             searchFilter.addEventListener('input', () => this.applyFilters());
             searchFilter.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     e.preventDefault();
                     this.performQuickSearch();
                 }
             });
         }

         // Wallet event listeners
         if (window.ethereum) {
             window.ethereum.on('accountsChanged', (accounts) => {
                 this.handleAccountsChanged(accounts);
             });
             
             window.ethereum.on('chainChanged', (chainId) => {
                 this.handleNetworkChange(chainId);
             });
         }
     }

    renderNetworkSelector() {
        const selector = document.getElementById('networkSelector');
        selector.innerHTML = '';

        Object.entries(this.networks).forEach(([key, network]) => {
            const option = document.createElement('div');
            option.className = 'network-option';
            option.dataset.network = key;
            
            option.innerHTML = `
                <div class="network-name">${network.name}</div>
                <div class="network-chain">Chain ID: ${network.chainId}</div>
            `;
            
            option.addEventListener('click', () => this.selectNetwork(key));
            selector.appendChild(option);
        });
    }

    selectNetwork(networkKey) {
        // Remove previous selection
        document.querySelectorAll('.network-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select new network
        document.querySelector(`[data-network="${networkKey}"]`).classList.add('selected');
        this.selectedNetwork = networkKey;
        
        // Update contract info display
        this.updateContractInfo();
    }

    updateContractInfo() {
        const contractsInfo = document.getElementById('contractsInfo');
        const contractAddresses = document.getElementById('contractAddresses');
        
        if (!this.selectedNetwork) {
            contractsInfo.style.display = 'none';
            return;
        }

        const network = this.networks[this.selectedNetwork];
        contractsInfo.style.display = 'block';
        
        contractAddresses.innerHTML = `
            <div style="margin-bottom: 15px;">
                <strong>${network.name}</strong>
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Identity Registry:</strong>
                <div class="contract-address">${network.contracts.identityRegistry || 'Not deployed yet'}</div>
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Reputation Registry:</strong>
                <div class="contract-address">${network.contracts.reputationRegistry || 'Not deployed yet'}</div>
            </div>
            <div style="margin-bottom: 10px;">
                <strong>Validation Registry:</strong>
                <div class="contract-address">${network.contracts.validationRegistry || 'Not deployed yet'}</div>
            </div>
        `;
    }

    async checkWalletConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet();
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        }
    }

    async connectWallet() {
        try {
            // Check if ethers is available
            if (typeof ethers === 'undefined') {
                this.showStatus('Web3 libraries not loaded. Please refresh the page.', 'error');
                return;
            }

            if (typeof window.ethereum === 'undefined') {
                this.showStatus('Please install MetaMask or another Web3 wallet', 'error');
                return;
            }

            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            const address = await this.signer.getAddress();
            const network = await this.provider.getNetwork();
            
            // Update UI
            const walletInfo = document.getElementById('walletInfo');
            walletInfo.classList.add('connected');
            document.getElementById('walletStatus').innerHTML = `
                <i class="fas fa-check-circle" style="color: #10b981;"></i>
                Connected: ${address.substring(0, 6)}...${address.substring(38)}
                <br><small>Network: ${network.name} (${network.chainId})</small>
                         `;
             document.getElementById('connectWallet').style.display = 'none';
             document.getElementById('registrationForm').style.display = 'block';
             document.getElementById('lookupSection').style.display = 'block';
             
             // Auto-fill agent address
             document.getElementById('agentAddress').value = address;
            
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showStatus('Failed to connect wallet: ' + error.message, 'error');
        }
    }

    async handleRegistration(event) {
        event.preventDefault();
        
        if (!this.selectedNetwork) {
            this.showStatus('Please select a network', 'error');
            return;
        }
        
        if (!this.signer) {
            this.showStatus('Please connect your wallet first', 'error');
            return;
        }

        const agentDomain = document.getElementById('agentDomain').value.trim();
        const agentAddress = document.getElementById('agentAddress').value.trim();
        
        if (!agentDomain || !agentAddress) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        // Validate Ethereum address
        if (!ethers.utils.isAddress(agentAddress)) {
            this.showStatus('Invalid Ethereum address', 'error');
            return;
        }

                 try {
             // Check if domain or address is already registered
             await this.checkExistingRegistration(agentDomain, agentAddress);
             await this.registerAgent(agentDomain, agentAddress);
         } catch (error) {
             console.error('Registration error:', error);
             this.showStatus('Registration failed: ' + error.message, 'error');
         }
         }

     async checkExistingRegistration(agentDomain, agentAddress) {
         const network = this.networks[this.selectedNetwork];
         // Use read-only provider for checks
         const readProvider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
         const contract = new ethers.Contract(
             network.contracts.identityRegistry,
             this.identityRegistryABI,
             readProvider
         );

         try {
             // Check domain
             const domainResult = await contract.callStatic.resolveByDomain(agentDomain);
             if (domainResult.agentId && domainResult.agentId.gt(0)) {
                 throw new Error(`Domain "${agentDomain}" is already registered with Agent ID ${domainResult.agentId.toString()}`);
             }
         } catch (error) {
             // Domain not found is expected for new registrations
             if (!error.message.includes('AgentNotFound') && !error.message.includes('revert')) {
                 console.log('Domain check error:', error);
             }
         }

         try {
             // Check address
             const addressResult = await contract.callStatic.resolveByAddress(agentAddress);
             if (addressResult.agentId && addressResult.agentId.gt(0)) {
                 throw new Error(`Address "${agentAddress}" is already registered with Agent ID ${addressResult.agentId.toString()}`);
             }
         } catch (error) {
             // Address not found is expected for new registrations
             if (!error.message.includes('AgentNotFound') && !error.message.includes('revert')) {
                 console.log('Address check error:', error);
             }
         }
     }

     async registerAgent(agentDomain, agentAddress) {
        const network = this.networks[this.selectedNetwork];
        
        if (!network.contracts.identityRegistry) {
            this.showStatus('Contracts not deployed on this network yet', 'error');
            return;
        }

        this.showStatus('Registering agent...', 'loading');
        
        try {
            // Check if we need to switch networks
            const currentNetwork = await this.provider.getNetwork();
            if (currentNetwork.chainId !== network.chainId) {
                await this.switchNetwork(network);
            }
            
            // Create contract instance
            const contract = new ethers.Contract(
                network.contracts.identityRegistry,
                this.identityRegistryABI,
                this.signer
            );
            
            // Estimate gas
            const gasEstimate = await contract.estimateGas.newAgent(agentDomain, agentAddress);
            
            // Send transaction
            const tx = await contract.newAgent(agentDomain, agentAddress, {
                gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
            });
            
            this.showStatus(`Transaction sent: ${tx.hash}`, 'loading');
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            // Parse events to get agent ID
            const event = receipt.events?.find(e => e.event === 'AgentRegistered');
            const agentId = event?.args?.agentId?.toString();
            
                         this.showStatus(`
                 <i class="fas fa-check-circle"></i> 
                 Agent registered successfully!<br>
                 <strong>Agent ID:</strong> <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${agentId}</span><br>
                 <strong>Domain:</strong> ${agentDomain}<br>
                 <strong>Address:</strong> ${agentAddress}<br>
                 <strong>Transaction:</strong> 
                 <a href="${network.explorer}/tx/${tx.hash}" target="_blank" style="color: inherit;">
                     ${tx.hash.substring(0, 10)}...
                 </a>
             `, 'success');
             
             // Clear form
             document.getElementById('agentDomain').value = '';
             document.getElementById('agentAddress').value = '';
            
                 } catch (error) {
             console.log('Registration error details:', error);
             
             if (error.code === 4001) {
                 this.showStatus('Transaction cancelled by user', 'error');
             } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                 // Decode the revert reason
                 const errorData = error.error?.data;
                 if (errorData === '0x7b857a6b') {
                     this.showStatus('⚠️ Domain is already registered! Try using the lookup feature to find the existing registration.', 'error');
                 } else if (errorData === '0x4ca88867') {
                     this.showStatus('⚠️ Address is already registered! This address already has an agent.', 'error');
                 } else if (errorData === '0x5f7b88b5') {
                     this.showStatus('⚠️ Unauthorized registration! You can only register agents for your own address.', 'error');
                 } else {
                     this.showStatus('Registration failed: Transaction would revert. The domain or address might already be registered.', 'error');
                 }
             } else if (error.code === -32603) {
                 this.showStatus('Transaction failed: ' + (error.data?.message || error.message), 'error');
             } else {
                 this.showStatus('Registration failed: ' + error.message, 'error');
             }
         }
    }

    async switchNetwork(network) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ethers.utils.hexValue(network.chainId) }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: ethers.utils.hexValue(network.chainId),
                            chainName: network.name,
                            rpcUrls: [network.rpcUrl],
                            blockExplorerUrls: [network.explorer]
                        }],
                    });
                } catch (addError) {
                    throw new Error('Failed to add network to wallet');
                }
            } else {
                throw switchError;
            }
                 }
     }

     async handleLookup() {
         if (!this.selectedNetwork) {
             this.showStatus('Please select a network', 'error');
             return;
         }
         
         if (!this.provider) {
             this.showStatus('Please connect your wallet first', 'error');
             return;
         }

         const domain = document.getElementById('lookupDomain').value.trim();
         if (!domain) {
             this.showStatus('Please enter a domain to lookup', 'error');
             return;
         }

         try {
             await this.lookupAgent(domain);
         } catch (error) {
             console.error('Lookup error:', error);
             this.showStatus('Lookup failed: ' + error.message, 'error');
         }
     }

     async lookupAgent(domain) {
         const network = this.networks[this.selectedNetwork];
         
         if (!network.contracts.identityRegistry) {
             this.showStatus('Contracts not deployed on this network yet', 'error');
             return;
         }

         this.showStatus('Looking up agent...', 'loading');

         try {
             // Use read-only provider for the selected network (no wallet switch needed)
             const readProvider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
             
             // Create contract instance
             const contract = new ethers.Contract(
                 network.contracts.identityRegistry,
                 this.identityRegistryABI,
                 readProvider
             );

             // Use callStatic to avoid gas estimation issues
             const result = await contract.callStatic.resolveByDomain(domain);
             const { agentId, agentDomain: resolvedDomain, agentAddress } = result;

             if (agentId && agentId.gt(0)) {
                 this.showStatus(`
                     <i class="fas fa-check-circle"></i> 
                     Agent found!<br>
                     <strong>Agent ID:</strong> <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${agentId.toString()}</span><br>
                     <strong>Domain:</strong> ${resolvedDomain}<br>
                     <strong>Address:</strong> ${agentAddress}<br>
                     <strong>Explorer:</strong> 
                     <a href="${network.explorer}/address/${agentAddress}" target="_blank" style="color: inherit;">
                         View on ${network.name}
                     </a>
                 `, 'success');
             } else {
                 this.showStatus(`No agent found for domain: ${domain}`, 'error');
             }

         } catch (error) {
             console.log('Lookup error details:', error);
             
             // Check if the error contains successful data that ethers.js couldn't decode
             if (error.code === 'CALL_EXCEPTION' && error.data) {
                 try {
                     // Manual decode the return data (AgentInfo struct)
                     const decoded = ethers.utils.defaultAbiCoder.decode(
                         ['tuple(uint256,string,address)'],
                         error.data
                     );
                     
                     const [agentInfo] = decoded;
                     const { 0: agentId, 1: resolvedDomain, 2: agentAddress } = agentInfo;
                     
                     if (agentId && agentId.gt(0)) {
                         this.showStatus(`
                             <i class="fas fa-check-circle"></i> 
                             Agent found!<br>
                             <strong>Agent ID:</strong> <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${agentId.toString()}</span><br>
                             <strong>Domain:</strong> ${resolvedDomain}<br>
                             <strong>Address:</strong> ${agentAddress}<br>
                             <strong>Explorer:</strong> 
                             <a href="${network.explorer}/address/${agentAddress}" target="_blank" style="color: inherit;">
                                 View on ${network.name}
                             </a>
                         `, 'success');
                         return;
                     }
                 } catch (decodeError) {
                     console.log('Failed to decode error data:', decodeError);
                 }
             }
             
             // If we get here, domain is not registered
             this.showStatus(`Domain "${domain}" is not registered yet`, 'error');
         }
     }
 
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.nav-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update sections
        document.querySelectorAll('.discovery-section, .register-section').forEach(section => {
            section.style.display = 'none';
        });

        if (tabName === 'discovery') {
            document.querySelector('.discovery-section').style.display = 'block';
        } else if (tabName === 'register') {
            document.querySelector('.register-section').style.display = 'block';
        }

        this.currentTab = tabName;
    }

    async discoverAllAgents() {
        if (this.isDiscovering) {
            console.log('⚠️ Discovery already in progress, skipping...');
            return;
        }
        
        this.isDiscovering = true;
        console.log('🔍 Starting agent discovery across all networks...');
        this.showDiscoveryStatus('Discovering agents across all networks...', 'loading');
        
        const discoveryLoading = document.getElementById('discoveryLoading');
        if (discoveryLoading) {
            discoveryLoading.style.display = 'block';
        }

        this.discoveredAgents = [];
        let totalAgents = 0;
        const aiModels = new Set();
        const trustModels = new Set();

        // Discover agents from all networks
        for (const [networkKey, network] of Object.entries(this.networks)) {
            if (network.contracts.identityRegistry) {
                console.log(`🌐 Discovering agents on ${network.name}...`);
                this.showDiscoveryStatus(`Discovering agents on ${network.name}...`, 'loading');
                
                try {
                    const agents = await this.discoverAgentsFromNetwork(networkKey);
                    console.log(`📊 Found ${agents.length} agents on ${network.name}`);
                    this.discoveredAgents.push(...agents);
                    totalAgents += agents.length;
                    
                    // Collect AI models and trust models for filters
                    agents.forEach(agent => {
                        if (agent.agentCard?.aiModel?.model) {
                            aiModels.add(agent.agentCard.aiModel.model);
                        }
                        if (agent.agentCard?.trustModels) {
                            agent.agentCard.trustModels.forEach(tm => trustModels.add(tm));
                        }
                    });
                    
                    // Update stats and render progressively
                    this.updateDiscoveryStats(totalAgents, aiModels.size, trustModels.size);
                    this.updateFilterOptions(aiModels);
                    this.applyFilters(); // Show agents as they're discovered
                } catch (error) {
                    console.error(`❌ Error discovering agents on ${network.name}:`, error);
                }
            }
        }

        // Update stats
        this.updateDiscoveryStats(totalAgents, aiModels.size, trustModels.size);
        
        // Update filter options
        this.updateFilterOptions(aiModels);

        // Apply filters and render
        this.applyFilters();

        if (discoveryLoading) {
            discoveryLoading.style.display = 'none';
        }

        console.log(`✅ Discovery complete: ${totalAgents} total agents found`);
        
        this.showDiscoveryStatus(`Discovered ${totalAgents} agents across ${Object.keys(this.networks).length} networks`, 'success');
        this.isDiscovering = false;
    }

    async performQuickSearch() {
        const searchInput = document.getElementById('searchFilter');
        const searchTerm = searchInput?.value?.trim();
        
        if (!searchTerm) {
            this.showDiscoveryStatus('Please enter a domain or name to search', 'error');
            if (searchInput) searchInput.focus();
            return;
        }

        console.log(`🔍 Quick search for: "${searchTerm}"`);
        this.showDiscoveryStatus(`Searching for "${searchTerm}"...`, 'loading');
        
        const discoveryLoading = document.getElementById('discoveryLoading');
        if (discoveryLoading) {
            discoveryLoading.style.display = 'block';
        }

        const searchResults = [];
        let networksSearched = 0;
        let totalNetworks = 0;

        // Count networks with contracts
        for (const [networkKey, network] of Object.entries(this.networks)) {
            if (network.contracts.identityRegistry) {
                totalNetworks++;
            }
        }

        // Search across all networks
        for (const [networkKey, network] of Object.entries(this.networks)) {
            if (network.contracts.identityRegistry) {
                try {
                    networksSearched++;
                    this.showDiscoveryStatus(`Searching ${network.name}... (${networksSearched}/${totalNetworks})`, 'loading');
                    
                    const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
                    const contract = new ethers.Contract(
                        network.contracts.identityRegistry,
                        this.identityRegistryABI,
                        provider
                    );

                    // Try exact domain match first
                    try {
                        const result = await contract.callStatic.resolveByDomain(searchTerm);
                        if (result.agentId && result.agentId.gt(0)) {
                            const agentData = await this.buildAgentData(result, networkKey, network);
                            searchResults.push(agentData);
                            console.log(`✅ Found exact match "${searchTerm}" on ${network.name}`);
                        }
                    } catch (error) {
                        // Exact match not found, try case variations
                        const variations = [
                            searchTerm.toLowerCase(),
                            searchTerm.toUpperCase(),
                            searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase()
                        ];

                        for (const variation of variations) {
                            if (variation === searchTerm) continue; // Skip original
                            try {
                                const result = await contract.callStatic.resolveByDomain(variation);
                                if (result.agentId && result.agentId.gt(0)) {
                                    const agentData = await this.buildAgentData(result, networkKey, network);
                                    searchResults.push(agentData);
                                    console.log(`✅ Found case variation "${variation}" on ${network.name}`);
                                    break; // Found one variation, stop trying others
                                }
                            } catch (variationError) {
                                // This variation not found either
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error searching ${network.name}:`, error);
                }
            }
        }

        if (discoveryLoading) {
            discoveryLoading.style.display = 'none';
        }

        // Show results
        if (searchResults.length > 0) {
            this.filteredAgents = searchResults;
            this.discoveredAgents = [...searchResults]; // Update discovered agents too
            this.renderAgentsGrid();
            this.updateDiscoveryStats(searchResults.length, 0, 0);
            this.showDiscoveryStatus(`Found ${searchResults.length} result(s) for "${searchTerm}"`, 'success');
        } else {
            this.filteredAgents = [];
            this.renderAgentsGrid();
            this.showDiscoveryStatus(`No agents found for "${searchTerm}". Try the full discovery to browse all agents.`, 'error');
        }
    }

    async buildAgentData(contractResult, networkKey, network) {
        const agentData = {
            id: contractResult.agentId.toString(),
            domain: contractResult.agentDomain,
            address: contractResult.agentAddress,
            network: networkKey,
            networkName: network.name,
            explorer: network.explorer,
            agentCard: null
        };

        // Try to fetch AgentCard
        try {
            const agentCardUrl = `https://${contractResult.agentDomain}/.well-known/agent-card.json`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(agentCardUrl, { 
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                agentData.agentCard = await response.json();
            }
        } catch (cardError) {
            // AgentCard fetch failed - that's okay
        }

        return agentData;
    }

    async discoverAgentsFromNetwork(networkKey) {
        const network = this.networks[networkKey];
        const agents = [];

        try {
            // Create read-only provider (ethers v5 syntax)
            const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
            const contract = new ethers.Contract(
                network.contracts.identityRegistry,
                this.identityRegistryABI,
                provider
            );

            // Get total agent count
            const totalCount = await contract.getAgentCount();
            console.log(`📊 ${network.name}: ${totalCount} agents registered`);

            // Fetch all agents
            for (let i = 1; i <= totalCount.toNumber(); i++) {
                try {
                    const agent = await contract.getAgent(i);
                    const agentData = {
                        id: agent.agentId.toString(),
                        domain: agent.agentDomain,
                        address: agent.agentAddress,
                        network: networkKey,
                        networkName: network.name,
                        explorer: network.explorer,
                        agentCard: null
                    };

                    // Try to fetch AgentCard
                    try {
                        const agentCardUrl = `https://${agent.agentDomain}/.well-known/agent-card.json`;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        
                        const response = await fetch(agentCardUrl, { 
                            signal: controller.signal,
                            headers: {
                                'Accept': 'application/json'
                            }
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (response.ok) {
                            agentData.agentCard = await response.json();
                        }
                    } catch (cardError) {
                        // AgentCard fetch failures are expected and normal
                        // Most domains don't host AgentCards yet
                    }

                    agents.push(agentData);
                } catch (error) {
                    console.log(`⚠️ Error fetching agent ${i} on ${network.name}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`❌ Error discovering agents on ${network.name}:`, error);
        }

        return agents;
    }

    updateDiscoveryStats(totalAgents, aiModelsCount, trustModelsCount) {
        const totalAgentsEl = document.getElementById('totalAgentsCount');
        const aiModelsEl = document.getElementById('aiModelsCount');
        const trustModelsEl = document.getElementById('trustModelsCount');

        if (totalAgentsEl) totalAgentsEl.textContent = totalAgents;
        if (aiModelsEl) aiModelsEl.textContent = aiModelsCount;
        if (trustModelsEl) trustModelsEl.textContent = trustModelsCount;
    }

    updateFilterOptions(aiModels) {
        const aiModelFilter = document.getElementById('aiModelFilter');
        if (aiModelFilter) {
            // Clear existing options (except "All Models")
            while (aiModelFilter.children.length > 1) {
                aiModelFilter.removeChild(aiModelFilter.lastChild);
            }

            // Add AI model options
            Array.from(aiModels).sort().forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                aiModelFilter.appendChild(option);
            });
        }
    }

    applyFilters() {
        const networkFilter = document.getElementById('networkFilter')?.value || '';
        const aiModelFilter = document.getElementById('aiModelFilter')?.value || '';
        const trustModelFilter = document.getElementById('trustModelFilter')?.value || '';
        const searchFilter = document.getElementById('searchFilter')?.value.toLowerCase() || '';

        this.filteredAgents = this.discoveredAgents.filter(agent => {
            // Network filter
            if (networkFilter && agent.network !== networkFilter) {
                return false;
            }

            // AI Model filter
            if (aiModelFilter && (!agent.agentCard?.aiModel?.model || agent.agentCard.aiModel.model !== aiModelFilter)) {
                return false;
            }

            // Trust Model filter
            if (trustModelFilter && (!agent.agentCard?.trustModels || !agent.agentCard.trustModels.includes(trustModelFilter))) {
                return false;
            }

            // Search filter
            if (searchFilter) {
                const searchableText = [
                    agent.domain,
                    agent.agentCard?.name || '',
                    agent.agentCard?.description || '',
                    agent.address
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchFilter)) {
                    return false;
                }
            }

            return true;
        });

        this.renderAgentsGrid();
    }

    renderAgentsGrid() {
        const agentsGrid = document.getElementById('agentsGrid');
        if (!agentsGrid) {
            console.error('❌ agentsGrid element not found!');
            return;
        }

        if (this.filteredAgents.length === 0) {
            const message = this.discoveredAgents.length === 0 
                ? `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">
                    <i class="fas fa-compass" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>Welcome to the ERC-8004 Agent Explorer</h3>
                    <p style="margin-bottom: 15px;">Choose your exploration method:</p>
                    <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                        <div style="background: #f8fafc; padding: 15px; border-radius: 10px; max-width: 200px;">
                            <i class="fas fa-search" style="color: #7c3aed; margin-bottom: 8px;"></i>
                            <h4 style="margin: 0 0 5px 0; color: #374151;">Quick Search</h4>
                            <p style="margin: 0; font-size: 0.9rem;">Search for specific agents by domain name</p>
                        </div>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 10px; max-width: 200px;">
                            <i class="fas fa-compass" style="color: #059669; margin-bottom: 8px;"></i>
                            <h4 style="margin: 0 0 5px 0; color: #374151;">Discover All</h4>
                            <p style="margin: 0; font-size: 0.9rem;">Browse all registered agents across networks</p>
                        </div>
                    </div>
                   </div>`
                : `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">
                    <i class="fas fa-filter" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No agents match your filters</h3>
                    <p>Try adjusting your filters to see more agents</p>
                   </div>`;
            agentsGrid.innerHTML = message;
            return;
        }

        agentsGrid.innerHTML = this.filteredAgents.map(agent => this.renderAgentCard(agent)).join('');
    }

    renderAgentCard(agent) {
        const agentCard = agent.agentCard;
        const hasAiModel = agentCard?.aiModel;
        const trustModels = agentCard?.trustModels || [];

        return `
            <div class="agent-card">
                <div class="agent-card-header">
                    <div class="agent-id">#${agent.id}</div>
                    <h3>${agentCard?.name || agent.domain}</h3>
                    <div class="agent-domain">${agent.domain}</div>
                </div>
                
                <div class="agent-card-body">
                    ${agentCard?.description ? `
                        <div class="agent-info-row">
                            <span class="agent-info-label">Description</span>
                            <span class="agent-info-value">${agentCard.description}</span>
                        </div>
                    ` : ''}
                    
                    <div class="agent-info-row">
                        <span class="agent-info-label">Address</span>
                        <span class="agent-info-value">${agent.address.substring(0, 6)}...${agent.address.substring(38)}</span>
                    </div>
                    
                    ${trustModels.length > 0 ? `
                        <div class="agent-info-row">
                            <span class="agent-info-label">Trust Models</span>
                            <div class="trust-models">
                                ${trustModels.map(tm => `<span class="trust-model">${tm}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${hasAiModel ? `
                        <div class="ai-model-info">
                            <h4><i class="fas fa-brain"></i> AI Model Information</h4>
                            <div class="ai-model-details">
                                <div class="ai-model-detail">
                                    <span class="label">Model:</span>
                                    <span class="value">${agentCard.aiModel.model || 'N/A'}</span>
                                </div>
                                <div class="ai-model-detail">
                                    <span class="label">Provider:</span>
                                    <span class="value">${agentCard.aiModel.provider || 'N/A'}</span>
                                </div>
                                ${agentCard.aiModel.version ? `
                                    <div class="ai-model-detail">
                                        <span class="label">Version:</span>
                                        <span class="value">${agentCard.aiModel.version}</span>
                                    </div>
                                ` : ''}
                                ${agentCard.aiModel.contextWindow ? `
                                    <div class="ai-model-detail">
                                        <span class="label">Context:</span>
                                        <span class="value">${agentCard.aiModel.contextWindow.toLocaleString()}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="agent-card-footer">
                    <span class="network-badge">${agent.networkName}</span>
                    <button class="view-details" onclick="window.open('${agent.explorer}/address/${agent.address}', '_blank')">
                        <i class="fas fa-external-link-alt"></i> View
                    </button>
                </div>
            </div>
        `;
    }

    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        
        // Reset UI
        const walletInfo = document.getElementById('walletInfo');
        if (walletInfo) {
            walletInfo.classList.remove('connected');
        }
        
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus) {
            walletStatus.textContent = 'Connect your wallet to register an agent';
        }
        
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        const registrationForm = document.getElementById('registrationForm');
        const lookupSection = document.getElementById('lookupSection');
        
        if (connectBtn) connectBtn.style.display = 'inline-block';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        if (registrationForm) registrationForm.style.display = 'none';
        if (lookupSection) lookupSection.style.display = 'none';
    }

    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            this.disconnectWallet();
        } else {
            // Reconnect with new account
            this.connectWallet();
        }
    }

    handleNetworkChange(chainId) {
        // Update network info if wallet is connected
        if (this.provider) {
            this.connectWallet();
        }
    }


    showDiscoveryStatus(message, type) {
        const status = document.getElementById('discoveryStatus');
        if (status) {
            status.className = `status ${type}`;
            status.innerHTML = message;
            status.style.display = 'block';
            
            // Auto-hide success messages after 5 seconds
            if (type === 'success') {
                setTimeout(() => {
                    status.style.display = 'none';
                }, 5000);
            }
        }
    }

     showStatus(message, type) {
        const status = document.getElementById('status');
        status.className = `status ${type}`;
        status.innerHTML = message;
        status.style.display = 'block';
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 10000);
        }
    }

    // Method to update contract addresses after deployment
    updateContractAddresses(networkKey, addresses) {
        if (this.networks[networkKey]) {
            this.networks[networkKey].contracts = addresses;
            if (this.selectedNetwork === networkKey) {
                this.updateContractInfo();
            }
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if ethers.js loaded properly
    if (typeof ethers === 'undefined') {
        console.error('❌ ethers.js failed to load from CDN');
        document.getElementById('walletStatus').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
            Failed to load Web3 libraries. Please refresh the page.
        `;
        return;
    }
    
    console.log('✅ ethers.js loaded successfully:', ethers.version);
    window.trustlessAgentsApp = new TrustlessAgentsApp();
});

// Example of how to update contract addresses after deployment:
// window.trustlessAgentsApp.updateContractAddresses('sepolia', {
//     identityRegistry: '0x...',
//     reputationRegistry: '0x...',
//     validationRegistry: '0x...'
// });
