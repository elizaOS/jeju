/**
 * Compute Node Server
 *
 * OpenAI-compatible inference server with on-chain settlement
 */

import {
  getBytes,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
  verifyMessage,
  Wallet,
} from 'ethers';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  generateSimulatedAttestation,
  getAttestationHash,
} from './attestation';
import { detectHardware } from './hardware';
import { createInferenceEngine, type InferenceEngine } from './inference';
import type {
  AttestationReport,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';

/**
 * Compute Node Server
 */
export class ComputeNodeServer {
  private app: Hono;
  private wallet: Wallet;
  private config: ProviderConfig;
  private engines: Map<string, InferenceEngine> = new Map();
  private attestation: AttestationReport | null = null;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.wallet = new Wallet(config.privateKey);
    this.app = new Hono();

    // Initialize engines
    for (const model of config.models) {
      this.engines.set(model.name, createInferenceEngine(model));
    }

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // CORS
    this.app.use('/*', cors());

    // Health check
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        provider: this.wallet.address,
        models: this.config.models.map((m) => m.name),
      });
    });

    // List models
    this.app.get('/v1/models', (c) => {
      return c.json({
        object: 'list',
        data: this.config.models.map((m) => ({
          id: m.name,
          object: 'model',
          created: Date.now(),
          owned_by: this.wallet.address,
        })),
      });
    });

    // Attestation
    this.app.get('/v1/attestation/report', async (c) => {
      const nonce = c.req.query('nonce') || crypto.randomUUID();

      // Generate fresh attestation
      this.attestation = await generateSimulatedAttestation(this.wallet, nonce);

      return c.json({
        ...this.attestation,
        attestation_hash: getAttestationHash(this.attestation),
      });
    });

    // Chat completions
    this.app.post('/v1/chat/completions', async (c) => {
      // Verify auth headers (optional for local testing)
      const authValid = await this.verifyAuth(c);
      if (!authValid.valid && process.env.REQUIRE_AUTH === 'true') {
        return c.json({ error: { message: authValid.reason } }, 401);
      }

      const request = await c.req.json<ChatCompletionRequest>();

      // Find engine
      const engine = this.engines.get(request.model);
      if (!engine) {
        return c.json(
          { error: { message: `Model ${request.model} not found` } },
          404
        );
      }

      // Streaming
      if (request.stream) {
        return this.handleStreamingCompletion(c, engine, request);
      }

      // Non-streaming
      const response = await engine.complete(request);

      // Get user address and settlement nonce from auth headers
      const userAddress = c.req.header('x-jeju-address');
      const settlementNonceStr = c.req.header('x-jeju-settlement-nonce');

      // Generate request hash and settlement signature
      const requestHash = this.generateRequestHash(response);
      const inputTokens = response.usage.prompt_tokens;
      const outputTokens = response.usage.completion_tokens;

      // Only include settlement data if authenticated with settlement nonce
      if (userAddress && settlementNonceStr) {
        const settlementNonce = Number.parseInt(settlementNonceStr, 10);
        const settlementSig = await this.signSettlement(
          userAddress,
          requestHash,
          inputTokens,
          outputTokens,
          settlementNonce
        );

        return c.json({
          ...response,
          settlement: {
            provider: this.wallet.address,
            requestHash,
            inputTokens,
            outputTokens,
            nonce: settlementNonce,
            signature: settlementSig,
          },
        });
      }

      // Return without settlement data for unauthenticated requests
      return c.json(response);
    });

    // Hardware info
    this.app.get('/v1/hardware', async (c) => {
      const hardware = await detectHardware();
      return c.json(hardware);
    });
  }

  private async handleStreamingCompletion(
    _c: Context,
    engine: InferenceEngine,
    request: ChatCompletionRequest
  ): Promise<Response> {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for await (const chunk of engine.stream(request)) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  private verifyAuth(c: Context): { valid: boolean; reason?: string } {
    const address = c.req.header('x-jeju-address');
    const nonce = c.req.header('x-jeju-nonce');
    const signature = c.req.header('x-jeju-signature');
    const timestamp = c.req.header('x-jeju-timestamp');

    if (!address || !nonce || !signature || !timestamp) {
      return { valid: false, reason: 'Missing auth headers' };
    }

    // Check timestamp freshness (5 minute window)
    const ts = Number.parseInt(timestamp, 10);
    const now = Date.now();
    if (Math.abs(now - ts) > 5 * 60 * 1000) {
      return { valid: false, reason: 'Timestamp expired' };
    }

    // Verify signature - throws on malformed signature
    const message = `${address}:${nonce}:${timestamp}:${this.wallet.address}`;
    const recovered = verifyMessage(message, signature);

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }

  /**
   * Sign a response for on-chain settlement
   * The signature format must match what InferenceServing.settle() expects:
   * keccak256(user, provider, requestHash, inputTokens, outputTokens, nonce)
   */
  private async signSettlement(
    user: string,
    requestHash: string,
    inputTokens: number,
    outputTokens: number,
    nonce: number
  ): Promise<string> {
    const messageHash = solidityPackedKeccak256(
      ['address', 'address', 'bytes32', 'uint256', 'uint256', 'uint256'],
      [user, this.wallet.address, requestHash, inputTokens, outputTokens, nonce]
    );

    // Sign the hash (ethers adds the "\x19Ethereum Signed Message:\n32" prefix)
    return this.wallet.signMessage(getBytes(messageHash));
  }

  /**
   * Generate request hash from response
   */
  private generateRequestHash(response: ChatCompletionResponse): string {
    return keccak256(
      toUtf8Bytes(JSON.stringify({ id: response.id, model: response.model }))
    );
  }

  /**
   * Start the server
   */
  start(): void {
    console.log(`🚀 Compute Node starting...`);
    console.log(`   Provider: ${this.wallet.address}`);
    console.log(`   Port: ${this.config.port}`);
    console.log(
      `   Models: ${this.config.models.map((m) => m.name).join(', ')}`
    );

    Bun.serve({
      port: this.config.port,
      fetch: this.app.fetch,
    });

    console.log(
      `✅ Compute Node running at http://localhost:${this.config.port}`
    );
    console.log(`⚠️  Attestation: SIMULATED (wallet signatures only, no TEE)`);
  }

  /**
   * Get the Hono app for testing
   */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Get provider address
   */
  getAddress(): string {
    return this.wallet.address;
  }
}

/**
 * Create and start a compute node from environment variables
 */
export async function startComputeNode(): Promise<ComputeNodeServer> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const config: ProviderConfig = {
    privateKey,
    registryAddress: process.env.REGISTRY_ADDRESS || '',
    ledgerAddress: process.env.LEDGER_ADDRESS || '',
    inferenceAddress: process.env.INFERENCE_ADDRESS || '',
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    port: Number.parseInt(process.env.PORT || '8080', 10),
    models: [
      {
        name: process.env.MODEL_NAME || 'mock-model',
        backend: (process.env.MODEL_BACKEND as 'ollama' | 'mock') || 'mock',
        endpoint: process.env.MODEL_ENDPOINT,
        pricePerInputToken: BigInt(
          process.env.PRICE_PER_INPUT_TOKEN || '1000000000'
        ), // 1 gwei
        pricePerOutputToken: BigInt(
          process.env.PRICE_PER_OUTPUT_TOKEN || '2000000000'
        ), // 2 gwei
        maxContextLength: Number.parseInt(
          process.env.MAX_CONTEXT_LENGTH || '4096',
          10
        ),
      },
    ],
  };

  const server = new ComputeNodeServer(config);
  server.start();
  return server;
}
