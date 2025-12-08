/**
 * Compute Rental Manager
 *
 * Manages compute resource rentals including:
 * - SSH session management
 * - Docker container lifecycle
 * - Resource monitoring
 * - Session authentication
 */

import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import type { Hono } from 'hono';
import type { Context } from 'hono';
import type {
  ComputeResources,
  GPUType,
  RentalStatus,
  SessionMetrics,
  SSHSession,
} from '../sdk/types';
import { detectHardware } from './hardware';

// ============================================================================
// Types
// ============================================================================

interface RentalConfig {
  privateKey: string;
  rentalContractAddress: string;
  rpcUrl: string;
  sshPort: number;
  dockerEnabled: boolean;
  maxConcurrentRentals: number;
}

interface ActiveRental {
  rentalId: string;
  user: string;
  status: RentalStatus;
  startTime: number;
  endTime: number;
  sshPublicKey: string;
  containerImage?: string;
  startupScript?: string;
  container?: ManagedContainer;
  sshSessions: SSHSession[];
  metrics: SessionMetrics;
}

interface ManagedContainer {
  containerId: string;
  image: string;
  status: 'creating' | 'running' | 'paused' | 'stopped' | 'error';
  ports: Array<{ containerPort: number; hostPort: number; protocol: 'tcp' | 'udp' }>;
  createdAt: number;
  lastHealthCheck: number;
  healthy: boolean;
}

interface SSHKeyEntry {
  rentalId: string;
  publicKey: string;
  user: string;
  addedAt: number;
  expiresAt: number;
}

// ============================================================================
// Contract ABI
// ============================================================================

const RENTAL_ABI = [
  'function getRental(bytes32 rentalId) view returns (tuple(bytes32 rentalId, address user, address provider, uint8 status, uint256 startTime, uint256 endTime, uint256 totalCost, uint256 paidAmount, uint256 refundedAmount, string sshPublicKey, string containerImage, string startupScript, string sshHost, uint16 sshPort))',
  'function startRental(bytes32 rentalId, string sshHost, uint16 sshPort, string containerId)',
  'function completeRental(bytes32 rentalId)',
  'function isRentalActive(bytes32 rentalId) view returns (bool)',
  'function getRemainingTime(bytes32 rentalId) view returns (uint256)',
];

// ============================================================================
// Rental Manager
// ============================================================================

export class RentalManager {
  private wallet: Wallet;
  private contract: Contract;
  private config: RentalConfig;
  private activeRentals: Map<string, ActiveRental> = new Map();
  private authorizedKeys: Map<string, SSHKeyEntry> = new Map();
  private resourcesCache: ComputeResources | null = null;
  private cleanupInterval: Timer | null = null;

  constructor(config: RentalConfig) {
    this.config = config;
    const provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, provider);
    this.contract = new Contract(config.rentalContractAddress, RENTAL_ABI, this.wallet);
  }

  /**
   * Start the rental manager
   */
  async start(): Promise<void> {
    // Detect and cache hardware resources
    const hardware = await detectHardware();
    this.resourcesCache = this.hardwareToResources(hardware);

    // Start cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this.cleanupExpiredRentals(), 60_000);

    console.log('🚀 Rental Manager started');
    console.log(`   SSH Port: ${this.config.sshPort}`);
    console.log(`   Docker: ${this.config.dockerEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Max Concurrent: ${this.config.maxConcurrentRentals}`);
  }

  /**
   * Stop the rental manager
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Handle a new rental request from the chain
   */
  async handleNewRental(rentalId: string): Promise<void> {
    // Check capacity
    if (this.activeRentals.size >= this.config.maxConcurrentRentals) {
      throw new Error('Provider at capacity');
    }

    // Fetch rental from chain
    const rentalData = await this.contract.getRental(rentalId);

    // Validate
    if (rentalData.provider.toLowerCase() !== this.wallet.address.toLowerCase()) {
      throw new Error('Rental not for this provider');
    }

    // Create container if image specified
    let container: ManagedContainer | undefined;
    if (rentalData.containerImage && this.config.dockerEnabled) {
      container = await this.createContainer(
        rentalId,
        rentalData.containerImage,
        rentalData.startupScript
      );
    }

    // Authorize SSH key
    this.authorizeSSHKey(
      rentalId,
      rentalData.sshPublicKey,
      rentalData.user,
      Number(rentalData.endTime)
    );

    // Track rental
    const rental: ActiveRental = {
      rentalId,
      user: rentalData.user,
      status: 1, // ACTIVE
      startTime: Date.now(),
      endTime: Number(rentalData.endTime) * 1000,
      sshPublicKey: rentalData.sshPublicKey,
      containerImage: rentalData.containerImage,
      startupScript: rentalData.startupScript,
      container,
      sshSessions: [],
      metrics: this.getEmptyMetrics(),
    };

    this.activeRentals.set(rentalId, rental);

    // Notify chain that rental is started
    const containerId = container?.containerId || '';
    const hostname = await this.getPublicHostname();
    
    const tx = await this.contract.startRental(
      rentalId,
      hostname,
      this.config.sshPort,
      containerId
    );
    await tx.wait();

    console.log(`✅ Rental ${rentalId.slice(0, 10)}... started`);
    console.log(`   User: ${rentalData.user}`);
    console.log(`   Container: ${containerId || 'none'}`);
  }

  /**
   * Complete a rental
   */
  async completeRental(rentalId: string): Promise<void> {
    const rental = this.activeRentals.get(rentalId);
    if (!rental) {
      throw new Error('Rental not found');
    }

    // Stop container if exists
    if (rental.container) {
      await this.stopContainer(rental.container.containerId);
    }

    // Remove SSH authorization
    this.revokeSSHKey(rentalId);

    // Notify chain
    const tx = await this.contract.completeRental(rentalId);
    await tx.wait();

    // Remove from tracking
    this.activeRentals.delete(rentalId);

    console.log(`✅ Rental ${rentalId.slice(0, 10)}... completed`);
  }

  /**
   * Cleanup expired rentals
   */
  private async cleanupExpiredRentals(): Promise<void> {
    const now = Date.now();

    for (const [rentalId, rental] of this.activeRentals) {
      if (now > rental.endTime) {
        console.log(`⏰ Rental ${rentalId.slice(0, 10)}... expired, completing...`);
        await this.completeRental(rentalId);
      }
    }
  }

  // ============================================================================
  // SSH Key Management
  // ============================================================================

  /**
   * Authorize an SSH key for a rental
   */
  authorizeSSHKey(rentalId: string, publicKey: string, user: string, expiresAt: number): void {
    // Generate a fingerprint for the key
    const fingerprint = keccak256(toUtf8Bytes(publicKey)).slice(0, 18);

    this.authorizedKeys.set(fingerprint, {
      rentalId,
      publicKey,
      user,
      addedAt: Date.now(),
      expiresAt: expiresAt * 1000,
    });

    console.log(`🔑 SSH key authorized for rental ${rentalId.slice(0, 10)}...`);
  }

  /**
   * Revoke SSH key for a rental
   */
  revokeSSHKey(rentalId: string): void {
    for (const [fingerprint, entry] of this.authorizedKeys) {
      if (entry.rentalId === rentalId) {
        this.authorizedKeys.delete(fingerprint);
        console.log(`🔓 SSH key revoked for rental ${rentalId.slice(0, 10)}...`);
        return;
      }
    }
  }

  /**
   * Validate an SSH public key
   * Returns the rental ID if valid, null otherwise
   */
  validateSSHKey(publicKey: string): string | null {
    const fingerprint = keccak256(toUtf8Bytes(publicKey)).slice(0, 18);
    const entry = this.authorizedKeys.get(fingerprint);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.authorizedKeys.delete(fingerprint);
      return null;
    }

    return entry.rentalId;
  }

  /**
   * Get authorized keys in OpenSSH format
   */
  getAuthorizedKeysFile(): string {
    const lines: string[] = [];

    for (const entry of this.authorizedKeys.values()) {
      if (Date.now() <= entry.expiresAt) {
        lines.push(entry.publicKey);
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Docker Container Management
  // ============================================================================

  /**
   * Create a Docker container for a rental
   */
  private async createContainer(
    rentalId: string,
    image: string,
    startupScript?: string
  ): Promise<ManagedContainer> {
    if (!this.config.dockerEnabled) {
      throw new Error('Docker not enabled');
    }

    const containerId = `jeju-${rentalId.slice(2, 14)}`;

    // Build docker run command
    const args: string[] = [
      'docker', 'run', '-d',
      '--name', containerId,
      '--memory', '16g',
      '--cpus', '4',
    ];

    // Add GPU support if available
    if (this.resourcesCache && this.resourcesCache.gpuCount > 0) {
      args.push('--gpus', 'all');
    }

    // Expose SSH port
    const sshPort = 22000 + (this.activeRentals.size * 10);
    args.push('-p', `${sshPort}:22`);

    // Add startup script as environment variable
    if (startupScript) {
      const encoded = Buffer.from(startupScript).toString('base64');
      args.push('-e', `STARTUP_SCRIPT_B64=${encoded}`);
    }

    args.push(image);

    // Execute docker run
    const proc = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await new Response(proc.stdout).text(); // Drain stdout
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Failed to create container: ${stderr}`);
    }

    const container: ManagedContainer = {
      containerId,
      image,
      status: 'running',
      ports: [{ containerPort: 22, hostPort: sshPort, protocol: 'tcp' }],
      createdAt: Date.now(),
      lastHealthCheck: Date.now(),
      healthy: true,
    };

    console.log(`🐳 Container ${containerId} created`);
    return container;
  }

  /**
   * Stop and remove a container
   */
  private async stopContainer(containerId: string): Promise<void> {
    // Stop container
    const stopProc = Bun.spawn(['docker', 'stop', containerId], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await stopProc.exited;

    // Remove container
    const rmProc = Bun.spawn(['docker', 'rm', containerId], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await rmProc.exited;

    console.log(`🐳 Container ${containerId} stopped and removed`);
  }

  /**
   * Execute a command in a container
   */
  async execInContainer(containerId: string, command: string[]): Promise<string> {
    const proc = Bun.spawn(['docker', 'exec', containerId, ...command], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    return output;
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId: string): Promise<SessionMetrics> {
    const proc = Bun.spawn(
      ['docker', 'stats', containerId, '--no-stream', '--format', '{{json .}}'],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    // Parse JSON
    const stats = JSON.parse(output.trim());

    // Parse CPU percentage
    const cpuStr = stats.CPUPerc || '0%';
    const cpuUsage = parseFloat(cpuStr.replace('%', ''));

    // Parse memory
    const memStr = stats.MemUsage || '0MiB / 0MiB';
    const memParts = memStr.split('/')[0].trim();
    const memoryUsage = this.parseMemoryString(memParts);

    return {
      cpuUsage,
      memoryUsage,
      gpuUsage: 0, // Would need nvidia-smi for GPU stats
      gpuMemoryUsage: 0,
      networkRx: 0,
      networkTx: 0,
      diskUsage: 0,
      uptime: 0,
      lastUpdated: Date.now(),
    };
  }

  // ============================================================================
  // HTTP Routes
  // ============================================================================

  /**
   * Register rental management routes
   */
  registerRoutes(app: Hono): void {
    // List active rentals
    app.get('/v1/rentals', (c: Context) => {
      const rentals = Array.from(this.activeRentals.values()).map((r) => ({
        rentalId: r.rentalId,
        user: r.user,
        status: r.status,
        startTime: r.startTime,
        endTime: r.endTime,
        hasContainer: !!r.container,
        containerStatus: r.container?.status,
        activeSessions: r.sshSessions.length,
      }));

      return c.json({ rentals });
    });

    // Get rental details
    app.get('/v1/rentals/:rentalId', async (c: Context) => {
      const rentalId = c.req.param('rentalId');
      const rental = this.activeRentals.get(rentalId);

      if (!rental) {
        return c.json({ error: 'Rental not found' }, 404);
      }

      // Get fresh metrics if container exists
      if (rental.container) {
        rental.metrics = await this.getContainerStats(rental.container.containerId);
      }

      return c.json({
        rentalId: rental.rentalId,
        user: rental.user,
        status: rental.status,
        startTime: rental.startTime,
        endTime: rental.endTime,
        remainingSeconds: Math.max(0, Math.floor((rental.endTime - Date.now()) / 1000)),
        container: rental.container
          ? {
              containerId: rental.container.containerId,
              image: rental.container.image,
              status: rental.container.status,
              ports: rental.container.ports,
            }
          : null,
        metrics: rental.metrics,
        sshSessions: rental.sshSessions.length,
      });
    });

    // Get SSH authorized keys
    app.get('/v1/ssh/authorized_keys', (c: Context) => {
      return c.text(this.getAuthorizedKeysFile());
    });

    // SSH connection webhook (called by SSH server)
    app.post('/v1/ssh/connect', async (c: Context) => {
      const body = await c.req.json<{
        publicKey: string;
        clientIp: string;
      }>();

      const rentalId = this.validateSSHKey(body.publicKey);
      if (!rentalId) {
        return c.json({ error: 'Unauthorized key' }, 401);
      }

      const rental = this.activeRentals.get(rentalId);
      if (!rental) {
        return c.json({ error: 'Rental not found' }, 404);
      }

      // Record session
      const session: SSHSession = {
        sessionId: crypto.randomUUID(),
        rentalId,
        user: rental.user,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        clientIp: body.clientIp,
      };

      rental.sshSessions.push(session);

      return c.json({
        allowed: true,
        sessionId: session.sessionId,
        containerPort: rental.container?.ports[0]?.hostPort || 22,
      });
    });

    // Provider resources
    app.get('/v1/resources', async (c: Context) => {
      if (!this.resourcesCache) {
        const hardware = await detectHardware();
        this.resourcesCache = this.hardwareToResources(hardware);
      }

      return c.json({
        resources: this.resourcesCache,
        activeRentals: this.activeRentals.size,
        maxRentals: this.config.maxConcurrentRentals,
        sshEnabled: true,
        dockerEnabled: this.config.dockerEnabled,
      });
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private hardwareToResources(hardware: {
    platform: string;
    arch: string;
    cpus: number;
    memory: number;
    gpuType: string | null;
    gpuVram: number | null;
    teeCapable: boolean;
  }): ComputeResources {
    // Map GPU type string to enum
    let gpuType = 0; // NONE
    if (hardware.gpuType) {
      if (hardware.gpuType.includes('H100')) gpuType = 4;
      else if (hardware.gpuType.includes('H200')) gpuType = 5;
      else if (hardware.gpuType.includes('A100')) {
        gpuType = hardware.gpuVram && hardware.gpuVram > 50 ? 3 : 2;
      } else if (hardware.gpuType.includes('4090')) gpuType = 1;
      else if (hardware.gpuType.includes('M1')) gpuType = 7;
      else if (hardware.gpuType.includes('M2')) gpuType = 8;
      else if (hardware.gpuType.includes('M3')) gpuType = 9;
    }

    return {
      gpuType: gpuType as GPUType,
      gpuCount: hardware.gpuType ? 1 : 0,
      gpuVram: hardware.gpuVram || 0,
      cpuCores: hardware.cpus,
      memory: Math.floor(hardware.memory / (1024 * 1024 * 1024)),
      storage: 100, // Default 100GB
      bandwidth: 1000, // Default 1Gbps
      teeCapable: hardware.teeCapable,
    };
  }

  private async getPublicHostname(): Promise<string> {
    // Try to get external IP
    const proc = Bun.spawn(['hostname', '-I'], { stdout: 'pipe', stderr: 'pipe' });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0 && output.trim()) {
      return output.trim().split(' ')[0];
    }

    // Fallback to localhost
    return 'localhost';
  }

  private parseMemoryString(memStr: string): number {
    const match = memStr.match(/^([\d.]+)(\w+)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      b: 1,
      kib: 1024,
      mib: 1024 * 1024,
      gib: 1024 * 1024 * 1024,
      kb: 1000,
      mb: 1000 * 1000,
      gb: 1000 * 1000 * 1000,
    };

    return value * (multipliers[unit] || 1);
  }

  private getEmptyMetrics(): SessionMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      gpuUsage: 0,
      gpuMemoryUsage: 0,
      networkRx: 0,
      networkTx: 0,
      diskUsage: 0,
      uptime: 0,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Create rental manager from environment
 */
export function createRentalManager(): RentalManager {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY required');
  }

  return new RentalManager({
    privateKey,
    rentalContractAddress: process.env.RENTAL_ADDRESS || '',
    rpcUrl: process.env.RPC_URL || 'http://localhost:9545',
    sshPort: parseInt(process.env.SSH_PORT || '2222', 10),
    dockerEnabled: process.env.DOCKER_ENABLED !== 'false',
    maxConcurrentRentals: parseInt(process.env.MAX_RENTALS || '10', 10),
  });
}

