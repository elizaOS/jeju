/**
 * Phala Cold-Start Proxy
 *
 * On-demand scaling of Phala TEE nodes with TLS passthrough.
 * Client -> PhalaProxy -> Phala Node (TEE)
 */

import { Hono } from 'hono';
import type { Hex } from 'viem';

export interface PhalaNodeState {
  id: string;
  endpoint: string;
  status: 'cold' | 'starting' | 'warm' | 'hot' | 'draining' | 'stopped';
  lastActivity: number;
  startedAt: number | null;
  coldStartMs: number | null;
  requestsServed: number;
  teeStatus: 'simulated' | 'dstack-simulator' | 'intel-tdx';
  agentId: bigint | null;
  walletAddress: Hex;
}

export interface ProxyConfig {
  phalaApiKey: string;
  phalaProjectId: string;
  minWarmNodes: number;
  maxNodes: number;
  coldStartTimeoutMs: number;
  idleTimeoutMs: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  tlsPassthrough: boolean;
  dockerImage: string;
  envVars: Record<string, string>;
}

export interface ProxyStats {
  totalRequests: number;
  queuedRequests: number;
  averageColdStartMs: number;
  nodesWarm: number;
  nodesCold: number;
  nodesStarting: number;
}

interface QueuedRequest {
  id: string;
  model: string;
  resolve: (endpoint: string) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

export class PhalaProxy {
  private nodes: Map<string, PhalaNodeState> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private config: ProxyConfig;
  private stats: ProxyStats = {
    totalRequests: 0,
    queuedRequests: 0,
    averageColdStartMs: 0,
    nodesWarm: 0,
    nodesCold: 0,
    nodesStarting: 0,
  };
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ProxyConfig>) {
    this.config = {
      phalaApiKey: config.phalaApiKey ?? process.env.PHALA_API_KEY ?? '',
      phalaProjectId: config.phalaProjectId ?? process.env.PHALA_PROJECT_ID ?? '',
      minWarmNodes: config.minWarmNodes ?? 1,
      maxNodes: config.maxNodes ?? 10,
      coldStartTimeoutMs: config.coldStartTimeoutMs ?? 60000,
      idleTimeoutMs: config.idleTimeoutMs ?? 300000,
      scaleUpThreshold: config.scaleUpThreshold ?? 5,
      scaleDownThreshold: config.scaleDownThreshold ?? 600000,
      tlsPassthrough: config.tlsPassthrough ?? true,
      dockerImage: config.dockerImage ?? 'ghcr.io/jeju/compute-node:latest',
      envVars: config.envVars ?? {},
    };
  }

  async start(): Promise<void> {
    console.log('[PhalaProxy] Starting...');
    
    // Start background check loop
    this.checkInterval = setInterval(() => this.runMaintenanceLoop(), 10000);
    
    // Ensure minimum warm nodes
    await this.ensureMinWarmNodes();
    
    console.log('[PhalaProxy] Ready');
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Drain all nodes
    for (const node of this.nodes.values()) {
      await this.stopNode(node.id);
    }
    
    console.log('[PhalaProxy] Stopped');
  }

  /** Get an available node endpoint (client connects directly with TLS) */
  async getEndpoint(model: string): Promise<string> {
    this.stats.totalRequests++;
    
    // Find a warm/hot node
    const availableNode = this.findAvailableNode(model);
    
    if (availableNode) {
      availableNode.lastActivity = Date.now();
      availableNode.requestsServed++;
      availableNode.status = 'hot';
      return availableNode.endpoint;
    }
    
    // No available node - queue request and start cold node
    return this.queueRequestAndStartNode(model);
  }

  private async queueRequestAndStartNode(model: string): Promise<string> {
    // Check if we're at max capacity
    if (this.nodes.size >= this.config.maxNodes) {
      // Wait for existing node or timeout
      return this.waitForNode(model);
    }
    
    // Start a new node
    this.startNode();
    
    // Return promise that resolves when node is ready
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        model,
        resolve,
        reject,
        queuedAt: Date.now(),
      };
      
      this.requestQueue.push(request);
      this.stats.queuedRequests = this.requestQueue.length;
      
      // Set timeout
      setTimeout(() => {
        const idx = this.requestQueue.findIndex(r => r.id === request.id);
        if (idx >= 0) {
          this.requestQueue.splice(idx, 1);
          reject(new Error(`Cold start timeout after ${this.config.coldStartTimeoutMs}ms`));
        }
      }, this.config.coldStartTimeoutMs);
    });
  }

  private waitForNode(model: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        model,
        resolve,
        reject,
        queuedAt: Date.now(),
      };
      
      this.requestQueue.push(request);
      this.stats.queuedRequests = this.requestQueue.length;
      
      setTimeout(() => {
        const idx = this.requestQueue.findIndex(r => r.id === request.id);
        if (idx >= 0) {
          this.requestQueue.splice(idx, 1);
          reject(new Error('No nodes available and at max capacity'));
        }
      }, this.config.coldStartTimeoutMs);
    });
  }

  private findAvailableNode(_model: string): PhalaNodeState | null {
    for (const node of this.nodes.values()) {
      if (node.status === 'warm' || node.status === 'hot') {
        return node;
      }
    }
    return null;
  }

  private async startNode(): Promise<PhalaNodeState> {
    const nodeId = `phala-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const node: PhalaNodeState = {
      id: nodeId,
      endpoint: '',
      status: 'starting',
      lastActivity: Date.now(),
      startedAt: Date.now(),
      coldStartMs: null,
      requestsServed: 0,
      teeStatus: 'simulated', // Will be updated after deployment
      agentId: null,
      walletAddress: '0x0' as Hex,
    };
    
    this.nodes.set(nodeId, node);
    this.updateStats();
    
    console.log(`[PhalaProxy] Starting node: ${nodeId}`);
    
    // Deploy to Phala Cloud
    const deployedEndpoint = await this.deployToPhala(nodeId);
    
    node.endpoint = deployedEndpoint;
    node.status = 'warm';
    node.coldStartMs = Date.now() - (node.startedAt ?? Date.now());
    
    // Update average cold start time
    this.updateColdStartStats(node.coldStartMs);
    
    // Process queued requests
    this.processQueue();
    
    console.log(`[PhalaProxy] Node ready: ${nodeId} (${node.coldStartMs}ms cold start)`);
    
    return node;
  }

  private async deployToPhala(nodeId: string): Promise<string> {
    // If no API key, use local Docker deployment
    if (!this.config.phalaApiKey) {
      return this.deployLocally(nodeId);
    }
    
    console.log(`[PhalaProxy] Deploying to Phala Cloud: ${nodeId}`);
    
    // Real Phala Cloud deployment via dstack CLI API
    const response = await fetch('https://cloud.phala.network/api/v1/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.phalaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: this.config.phalaProjectId,
        name: nodeId,
        image: this.config.dockerImage,
        env: this.config.envVars,
        resources: {
          memory: '8GB',
          cpu: 2,
        },
        confidential: {
          enabled: true,
          attestation: true,
        },
        port: 8080,
        health_check: {
          path: '/health',
          interval: 30,
          timeout: 10,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Phala deployment failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json() as { 
      id: string;
      endpoint: string;
      status: string;
    };
    
    // Wait for deployment to be ready
    const endpoint = await this.waitForDeployment(result.id);
    
    console.log(`[PhalaProxy] Deployed: ${nodeId} -> ${endpoint}`);
    return endpoint;
  }

  private async deployLocally(nodeId: string): Promise<string> {
    console.log(`[PhalaProxy] Local deployment: ${nodeId}`);
    
    const { spawn } = await import('node:child_process');
    
    // Find an available port
    const port = 8080 + Math.floor(Math.random() * 1000);
    
    // Build env args
    const envArgs: string[] = [];
    for (const [key, value] of Object.entries(this.config.envVars)) {
      envArgs.push('-e', `${key}=${value}`);
    }
    
    // Start container
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', [
        'run', '-d',
        '--name', nodeId,
        '-p', `${port}:8080`,
        ...envArgs,
        this.config.dockerImage,
      ]);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      
      proc.on('close', async (code) => {
        if (code === 0) {
          // Wait for container to be healthy
          await this.waitForLocalContainer(nodeId, port);
          resolve(`http://localhost:${port}`);
        } else {
          reject(new Error(`Docker failed: ${stderr}`));
        }
      });
      
      proc.on('error', reject);
    });
  }

  private async waitForDeployment(deploymentId: string, maxWaitMs = 120000): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(`https://cloud.phala.network/api/v1/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.phalaApiKey}`,
        },
      });
      
      if (response.ok) {
        const status = await response.json() as {
          status: string;
          endpoint: string;
          error?: string;
        };
        
        if (status.status === 'running') {
          return status.endpoint;
        }
        
        if (status.status === 'failed') {
          throw new Error(`Deployment failed: ${status.error || 'unknown error'}`);
        }
      }
      
      await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
    }
    
    throw new Error(`Deployment timeout after ${maxWaitMs}ms`);
  }

  private async waitForLocalContainer(nodeId: string, port: number, maxWaitMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await fetch(`http://localhost:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    
    throw new Error(`Container ${nodeId} failed to become healthy`);
  }

  private async stopNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    node.status = 'draining';
    
    // In production, call Phala Cloud API to stop
    if (this.config.phalaApiKey) {
      await fetch(`https://cloud.phala.network/api/v1/deployments/${nodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.phalaApiKey}`,
        },
      });
    }
    
    node.status = 'stopped';
    this.nodes.delete(nodeId);
    this.updateStats();
    
    console.log(`[PhalaProxy] Stopped node: ${nodeId}`);
  }

  private async ensureMinWarmNodes(): Promise<void> {
    const warmCount = Array.from(this.nodes.values()).filter(
      n => n.status === 'warm' || n.status === 'hot'
    ).length;
    
    const needed = this.config.minWarmNodes - warmCount;
    
    for (let i = 0; i < needed; i++) {
      await this.startNode();
    }
  }

  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const node = this.findAvailableNode('');
      if (!node) break;
      
      const request = this.requestQueue.shift();
      if (request) {
        request.resolve(node.endpoint);
        node.lastActivity = Date.now();
        node.requestsServed++;
        this.stats.queuedRequests = this.requestQueue.length;
      }
    }
  }

  private async runMaintenanceLoop(): Promise<void> {
    const now = Date.now();
    
    // Check for idle nodes to scale down
    for (const node of this.nodes.values()) {
      if (node.status === 'warm' || node.status === 'hot') {
        const idleTime = now - node.lastActivity;
        
        // Mark as warm after idle threshold
        if (idleTime > this.config.idleTimeoutMs / 3) {
          node.status = 'warm';
        }
        
        // Scale down if idle too long (but keep minimum)
        const warmCount = Array.from(this.nodes.values()).filter(
          n => n.status === 'warm' || n.status === 'hot'
        ).length;
        
        if (idleTime > this.config.scaleDownThreshold && warmCount > this.config.minWarmNodes) {
          await this.stopNode(node.id);
        }
      }
    }
    
    // Scale up if queue is long
    if (this.requestQueue.length >= this.config.scaleUpThreshold) {
      const startingCount = Array.from(this.nodes.values()).filter(
        n => n.status === 'starting'
      ).length;
      
      if (startingCount === 0 && this.nodes.size < this.config.maxNodes) {
        this.startNode();
      }
    }
    
    // Ensure minimum warm nodes
    await this.ensureMinWarmNodes();
    
    this.updateStats();
  }

  private updateStats(): void {
    this.stats.nodesWarm = Array.from(this.nodes.values()).filter(
      n => n.status === 'warm' || n.status === 'hot'
    ).length;
    this.stats.nodesCold = Array.from(this.nodes.values()).filter(
      n => n.status === 'cold'
    ).length;
    this.stats.nodesStarting = Array.from(this.nodes.values()).filter(
      n => n.status === 'starting'
    ).length;
  }

  private updateColdStartStats(coldStartMs: number): void {
    const totalColdStarts = Array.from(this.nodes.values()).filter(
      n => n.coldStartMs !== null
    ).length;
    
    if (totalColdStarts === 1) {
      this.stats.averageColdStartMs = coldStartMs;
    } else {
      this.stats.averageColdStartMs = 
        (this.stats.averageColdStartMs * (totalColdStarts - 1) + coldStartMs) / totalColdStarts;
    }
  }

  getStats(): ProxyStats {
    return { ...this.stats };
  }

  getNodes(): PhalaNodeState[] {
    return Array.from(this.nodes.values());
  }

  createRouter(): Hono {
    const app = new Hono();
    
    // Health check
    app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        stats: this.getStats(),
      });
    });
    
    // Get endpoint for inference (TLS passthrough)
    app.post('/v1/route', async (c) => {
      const body = await c.req.json<{ model: string }>();
      
      const endpoint = await this.getEndpoint(body.model);
      
      return c.json({
        endpoint,
        tlsPassthrough: this.config.tlsPassthrough,
        notice: 'Connect directly to endpoint with TLS - proxy does not decrypt',
      });
    });
    
    // List nodes
    app.get('/nodes', (c) => {
      return c.json({
        nodes: this.getNodes().map(n => ({
          id: n.id,
          status: n.status,
          endpoint: n.endpoint,
          teeStatus: n.teeStatus,
          coldStartMs: n.coldStartMs,
          requestsServed: n.requestsServed,
        })),
      });
    });
    
    // Stats
    app.get('/stats', (c) => {
      return c.json(this.getStats());
    });
    
    return app;
  }
}

export async function createPhalaProxy(config: Partial<ProxyConfig>): Promise<PhalaProxy> {
  const proxy = new PhalaProxy(config);
  await proxy.start();
  return proxy;
}
