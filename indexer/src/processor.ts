import {assertNotNull} from '@subsquid/util-internal'
import {
    BlockHeader,
    DataHandlerContext,
    EvmBatchProcessor,
    EvmBatchProcessorFields,
    Log as _Log,
    Transaction as _Transaction,
    Trace as _Trace,
} from '@subsquid/evm-processor'

export const processor = new EvmBatchProcessor()
    .setRpcEndpoint({
        url: assertNotNull(process.env.RPC_ETH_HTTP, 'No RPC endpoint supplied'),
        rateLimit: 10
    })
    .setFinalityConfirmation(10)
    .setFields({
        block: {
            gasUsed: true,
            gasLimit: true,
            baseFeePerGas: true,
            difficulty: true,
            size: true,
        },
        transaction: {
            from: true,
            to: true,
            value: true,
            hash: true,
            gasPrice: true,
            gas: true,
            gasUsed: true,
            input: true,
            nonce: true,
            status: true,
            contractAddress: true,
            type: true,
            maxFeePerGas: true,
            maxPriorityFeePerGas: true,
        },
        log: {
            address: true,
            data: true,
            topics: true,
            transactionHash: true,
        },
        trace: {
            type: true,
            action: true,
            result: true,
            error: true,
            subtraces: true,
            traceAddress: true,
        }
    })
    .setBlockRange({
        from: parseInt(process.env.START_BLOCK || '0'),
    })
    // Index ALL transactions
    .addTransaction({})
    // Index ALL logs - CRITICAL for event tracking!
    .addLog({})
    // Note: Traces require debug_traceBlockByHash RPC method
    // Most public RPCs don't support this - enable when using archive node
    // .addTrace({})

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
export type Trace = _Trace<Fields>
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>
