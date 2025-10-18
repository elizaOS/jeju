/**
 * Smart RPC Detection - Prefers Jeju over Anvil
 *
 * This utility automatically detects which blockchain is available:
 * 1. First, try Jeju localnet/testnet/mainnet
 * 2. Fall back to Anvil if Jeju isn't running
 *
 * WHY: We want to test against Jeju (our actual L2/L3) in integration tests,
 * but still support Anvil for quick local development.
 */
export class RpcDetector {
    /**
     * Detect which blockchain is available and return RPC URL
     * Prefers Jeju if available
     */
    static async detectRpc() {
        console.log('🔍 Detecting available blockchain...');
        // Try Jeju first
        const jejuInfo = await this.checkChain(this.JEJU_RPC, 'Jeju');
        if (jejuInfo && jejuInfo.isJeju) {
            console.log(`✅ Using Jeju L2 at ${jejuInfo.rpcUrl}`);
            console.log(`   Chain ID: ${jejuInfo.chainId}`);
            console.log(`   Block: ${jejuInfo.blockNumber}`);
            return jejuInfo;
        }
        // Fall back to Anvil
        const anvilInfo = await this.checkChain(this.ANVIL_RPC, 'Anvil');
        if (anvilInfo) {
            console.log(`⚠️  Jeju not available, using Anvil at ${anvilInfo.rpcUrl}`);
            console.log(`   Chain ID: ${anvilInfo.chainId}`);
            console.log(`   Block: ${anvilInfo.blockNumber}`);
            console.log(`   💡 Tip: Start Jeju with 'bun run dev' for full L2/L3 testing`);
            return anvilInfo;
        }
        // Nothing available
        throw new Error('❌ No blockchain available!\n' +
            '   Options:\n' +
            '   1. Start Jeju: bun run dev (recommended)\n' +
            '   2. Start Anvil: anvil\n');
    }
    /**
     * Check if a specific RPC endpoint is available
     */
    static async checkChain(rpcUrl, name) {
        try {
            // Try to connect with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            // Get chain ID
            const chainIdResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_chainId',
                    params: [],
                    id: 1
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!chainIdResponse.ok) {
                return null;
            }
            const chainIdData = await chainIdResponse.json();
            const chainId = parseInt(chainIdData.result, 16);
            // Get block number to verify it's working
            const blockResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 2
                })
            });
            const blockData = await blockResponse.json();
            const blockNumber = parseInt(blockData.result, 16);
            // Determine if this is Jeju
            const isJeju = chainId === this.JEJU_LOCALNET_ID ||
                chainId === this.JEJU_TESTNET_ID ||
                chainId === this.JEJU_MAINNET_ID;
            const chainName = isJeju
                ? chainId === this.JEJU_LOCALNET_ID ? 'Jeju L2 (Localnet)'
                    : chainId === this.JEJU_TESTNET_ID ? 'Jeju L2 (Testnet)'
                        : 'Jeju L2 (Mainnet)'
                : name;
            return {
                chainId,
                name: chainName,
                rpcUrl,
                isJeju,
                blockNumber
            };
        }
        catch (error) {
            // Connection failed, RPC not available
            return null;
        }
    }
    /**
     * Get RPC URL (prefers Jeju)
     * Use this in all blockchain configuration
     */
    static async getRpcUrl() {
        const info = await this.detectRpc();
        return info.rpcUrl;
    }
    /**
     * Check if Jeju is available (without throwing)
     */
    static async isJejuAvailable() {
        const info = await this.checkChain(this.JEJU_RPC, 'Jeju');
        return info?.isJeju ?? false;
    }
    static async getChainInfo() {
        const now = Date.now();
        if (this.cachedInfo && (now - this.cacheTime) < this.CACHE_TTL) {
            return this.cachedInfo;
        }
        this.cachedInfo = await this.detectRpc();
        this.cacheTime = now;
        return this.cachedInfo;
    }
    /**
     * Clear cache (useful for tests)
     */
    static clearCache() {
        this.cachedInfo = null;
        this.cacheTime = 0;
    }
}
RpcDetector.JEJU_RPC = process.env.JEJU_RPC_URL || 'http://localhost:8545';
RpcDetector.ANVIL_RPC = 'http://localhost:8545';
// Jeju chain IDs
RpcDetector.JEJU_LOCALNET_ID = 420691;
RpcDetector.JEJU_TESTNET_ID = 901;
RpcDetector.JEJU_MAINNET_ID = 902;
// Anvil chain ID (standalone development)
RpcDetector.ANVIL_CHAIN_ID = 31337;
/**
 * Get chain info with caching for performance
 */
RpcDetector.cachedInfo = null;
RpcDetector.cacheTime = 0;
RpcDetector.CACHE_TTL = 30000; // 30 seconds
// Export convenience functions
export async function getRpcUrl() {
    return RpcDetector.getRpcUrl();
}
export async function getChainInfo() {
    return RpcDetector.getChainInfo();
}
export async function isJejuAvailable() {
    return RpcDetector.isJejuAvailable();
}
