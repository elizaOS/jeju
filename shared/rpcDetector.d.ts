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
interface ChainInfo {
    chainId: number;
    name: string;
    rpcUrl: string;
    isJeju: boolean;
    blockNumber: number;
}
export declare class RpcDetector {
    private static readonly JEJU_RPC;
    private static readonly ANVIL_RPC;
    private static readonly JEJU_LOCALNET_ID;
    private static readonly JEJU_TESTNET_ID;
    private static readonly JEJU_MAINNET_ID;
    private static readonly ANVIL_CHAIN_ID;
    /**
     * Detect which blockchain is available and return RPC URL
     * Prefers Jeju if available
     */
    static detectRpc(): Promise<ChainInfo>;
    /**
     * Check if a specific RPC endpoint is available
     */
    private static checkChain;
    /**
     * Get RPC URL (prefers Jeju)
     * Use this in all blockchain configuration
     */
    static getRpcUrl(): Promise<string>;
    /**
     * Check if Jeju is available (without throwing)
     */
    static isJejuAvailable(): Promise<boolean>;
    /**
     * Get chain info with caching for performance
     */
    private static cachedInfo;
    private static cacheTime;
    private static CACHE_TTL;
    static getChainInfo(): Promise<ChainInfo>;
    /**
     * Clear cache (useful for tests)
     */
    static clearCache(): void;
}
export declare function getRpcUrl(): Promise<string>;
export declare function getChainInfo(): Promise<ChainInfo>;
export declare function isJejuAvailable(): Promise<boolean>;
export {};
//# sourceMappingURL=rpcDetector.d.ts.map