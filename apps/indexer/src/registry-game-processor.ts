/**
 * Registry Processor - Indexes ERC-8004 agent registration events
 */

import { ethers } from 'ethers';
import { Store } from '@subsquid/typeorm-store';
import { ProcessorContext } from './processor';
import { RegisteredAgent, AgentMetadata, TagUpdate, RegistryStake, Account } from './model';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const registryInterface = new ethers.Interface([
    'event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)',
    'event TagsUpdated(uint256 indexed agentId, string[] tags)',
    'event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value)',
    'event StakeDeposited(uint256 indexed agentId, address token, uint256 amount)'
]);

const REGISTERED_EVENT = ethers.id('Registered(uint256,string,address)');
const TAGS_UPDATED_EVENT = ethers.id('TagsUpdated(uint256,string[])');
const METADATA_SET_EVENT = ethers.id('MetadataSet(uint256,string,string,bytes)');
const STAKE_DEPOSITED_EVENT = ethers.id('StakeDeposited(uint256,address,uint256)');

export async function processRegistryEvents(ctx: ProcessorContext<Store>): Promise<void> {
    const agents = new Map<string, RegisteredAgent>();
    const accounts = new Map<string, Account>();
    const metadataUpdates: AgentMetadata[] = [];
    const tagUpdates: TagUpdate[] = [];
    const stakes: RegistryStake[] = [];

    function getOrCreateAccount(address: string, blockNumber: number, timestamp: Date): Account {
        const id = address.toLowerCase();
        let account = accounts.get(id);
        if (!account) {
            account = new Account({
                id,
                address: id,
                isContract: false,
                firstSeenBlock: blockNumber,
                lastSeenBlock: blockNumber,
                transactionCount: 0,
                totalValueSent: 0n,
                totalValueReceived: 0n,
                labels: [],
                firstSeenAt: timestamp,
                lastSeenAt: timestamp
            });
            accounts.set(id, account);
        }
        return account;
    }

    for (const block of ctx.blocks) {
        const blockTimestamp = new Date(block.header.timestamp);

        for (const log of block.logs) {
            const topic0 = log.topics[0];
            if (!log.transaction) continue;
            const txHash = log.transaction.hash;

            if (topic0 === REGISTERED_EVENT) {
                const decoded = registryInterface.parseLog({ topics: log.topics, data: log.data });
                if (!decoded) continue;

                const agentId = BigInt(log.topics[1]);
                const id = agentId.toString();
                const owner = getOrCreateAccount(decoded.args.owner, block.header.height, blockTimestamp);

                agents.set(id, new RegisteredAgent({
                    id,
                    agentId,
                    owner,
                    tokenURI: decoded.args.tokenURI,
                    name: decoded.args.tokenURI,
                    tags: [],
                    stakeToken: ZERO_ADDRESS,
                    stakeAmount: 0n,
                    stakeWithdrawn: false,
                    registeredAt: blockTimestamp,
                    depositedAt: 0n,
                    active: true
                }));
            }
            else if (topic0 === TAGS_UPDATED_EVENT) {
                const decoded = registryInterface.parseLog({ topics: log.topics, data: log.data });
                if (!decoded) continue;

                const agentId = BigInt(log.topics[1]).toString();
                const agent = agents.get(agentId);
                if (!agent) continue;

                const oldTags = [...agent.tags];
                const newTags = decoded.args.tags as string[];
                agent.tags = newTags;

                tagUpdates.push(new TagUpdate({
                    id: `${txHash}-${log.logIndex}`,
                    agent,
                    oldTags,
                    newTags,
                    updatedAt: blockTimestamp,
                    txHash,
                    blockNumber: block.header.height
                }));
            }
            else if (topic0 === METADATA_SET_EVENT) {
                const decoded = registryInterface.parseLog({ topics: log.topics, data: log.data });
                if (!decoded) continue;

                const agentId = BigInt(log.topics[1]).toString();
                const agent = agents.get(agentId);
                if (!agent) continue;

                const key = decoded.args.key;
                const value = ethers.toUtf8String(decoded.args.value);

                if (key === 'name') agent.name = value;
                else if (key === 'description') agent.description = value;
                else if (key === 'a2aEndpoint') agent.a2aEndpoint = value;

                metadataUpdates.push(new AgentMetadata({
                    id: `${agentId}-${key}`,
                    agent,
                    key,
                    value,
                    updatedAt: blockTimestamp,
                    txHash,
                    blockNumber: block.header.height
                }));
            }
            else if (topic0 === STAKE_DEPOSITED_EVENT) {
                const decoded = registryInterface.parseLog({ topics: log.topics, data: log.data });
                if (!decoded) continue;

                const agentId = BigInt(log.topics[1]).toString();
                const agent = agents.get(agentId);
                if (!agent) continue;

                agent.stakeToken = decoded.args.token;
                agent.stakeAmount = BigInt(decoded.args.amount.toString());
                agent.depositedAt = BigInt(block.header.timestamp);

                stakes.push(new RegistryStake({
                    id: `${txHash}-${log.logIndex}`,
                    agent,
                    token: decoded.args.token,
                    amount: BigInt(decoded.args.amount.toString()),
                    depositedAt: BigInt(block.header.timestamp),
                    txHash,
                    blockNumber: block.header.height
                }));
            }
        }
    }

    await ctx.store.upsert(Array.from(accounts.values()));
    await ctx.store.upsert(Array.from(agents.values()));
    await ctx.store.insert(metadataUpdates);
    await ctx.store.insert(tagUpdates);
    await ctx.store.insert(stakes);
}
