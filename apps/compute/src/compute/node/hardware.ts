/**
 * Hardware detection for compute nodes
 * 
 * Supports: Mac (Apple Silicon + Intel), Linux (CUDA/ROCm), Windows (CUDA)
 */

import { spawn } from 'node:child_process';
import os from 'node:os';
import type { HardwareInfo } from './types';

/**
 * Execute a command and return stdout
 */
async function exec(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Get primary MAC address
 */
function getMacAddress(): string | null {
  const interfaces = os.networkInterfaces();
  
  // Priority: eth0 > en0 > first non-internal interface
  const priority = ['eth0', 'en0', 'enp0s3', 'wlan0', 'Wi-Fi'];
  
  for (const name of priority) {
    const iface = interfaces[name];
    if (iface) {
      const entry = iface.find(i => !i.internal && i.mac !== '00:00:00:00:00:00');
      if (entry) return entry.mac;
    }
  }
  
  // Fallback: first non-internal interface
  for (const [, iface] of Object.entries(interfaces)) {
    if (iface) {
      const entry = iface.find(i => !i.internal && i.mac !== '00:00:00:00:00:00');
      if (entry) return entry.mac;
    }
  }
  
  return null;
}

/**
 * Get CPU model string
 */
function getCpuModel(): string | null {
  const cpus = os.cpus();
  return cpus[0]?.model ?? null;
}

/**
 * Detect NVIDIA GPU using nvidia-smi
 */
async function detectNvidiaGpu(): Promise<{
  type: string;
  vram: number;
  cudaVersion: string;
} | null> {
  try {
    const output = await exec('nvidia-smi', [
      '--query-gpu=name,memory.total,driver_version',
      '--format=csv,noheader,nounits',
    ]);

    const parts = output.split(',').map((s) => s.trim());
    const name = parts[0] ?? 'Unknown GPU';
    const memoryMb = parts[1] ?? '0';

    // Get CUDA version
    const cudaOutput = await exec('nvidia-smi', [
      '--query-gpu=driver_version',
      '--format=csv,noheader',
    ]);

    return {
      type: name,
      vram: Number.parseInt(memoryMb, 10) * 1024 * 1024, // Convert MB to bytes
      cudaVersion: cudaOutput.trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Detect AMD ROCm GPU
 */
async function detectAmdGpu(): Promise<{
  type: string;
  vram: number;
} | null> {
  try {
    const output = await exec('rocm-smi', ['--showproductname']);
    const lines = output.split('\n');
    const gpuLine = lines.find(l => l.includes('GPU'));
    if (!gpuLine) return null;
    
    // Get memory
    const memOutput = await exec('rocm-smi', ['--showmeminfo', 'vram']);
    const memMatch = memOutput.match(/Total Memory \(B\):\s*(\d+)/);
    const vram = memMatch ? Number.parseInt(memMatch[1], 10) : 0;
    
    return {
      type: gpuLine.trim(),
      vram,
    };
  } catch {
    return null;
  }
}

/**
 * Detect Apple Silicon MLX
 */
async function detectMlx(): Promise<{ version: string } | null> {
  try {
    // Check if MLX is available
    const output = await exec('python3', [
      '-c',
      'import mlx; print(mlx.__version__)',
    ]);
    return { version: output.trim() };
  } catch {
    return null;
  }
}

/**
 * Get Apple Silicon chip name
 */
async function getAppleSiliconChip(): Promise<string | null> {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    return null;
  }
  
  try {
    const output = await exec('sysctl', ['-n', 'machdep.cpu.brand_string']);
    return output.trim();
  } catch {
    return 'Apple Silicon';
  }
}

/**
 * Get Apple Silicon unified memory
 */
function getAppleSiliconMemory(): number | null {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    return null;
  }
  // On Apple Silicon, all memory is unified (available to GPU)
  return os.totalmem();
}

/**
 * Detect TEE capabilities
 */
async function detectTeeCapable(): Promise<boolean> {
  // Check for Intel TDX
  if (process.platform === 'linux') {
    try {
      await exec('ls', ['/dev/tdx-guest']);
      return true;
    } catch {}
    
    // Check for AMD SEV
    try {
      await exec('ls', ['/dev/sev-guest']);
      return true;
    } catch {}
  }
  
  return false;
}

/**
 * Detect container runtime
 */
async function detectContainerRuntime(): Promise<'docker' | 'podman' | null> {
  try {
    await exec('docker', ['--version']);
    return 'docker';
  } catch {}
  
  try {
    await exec('podman', ['--version']);
    return 'podman';
  } catch {}
  
  return null;
}

/**
 * Detect hardware capabilities
 */
export async function detectHardware(): Promise<HardwareInfo> {
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const arch = process.arch as 'arm64' | 'x64';

  // Base info
  const baseInfo: HardwareInfo = {
    platform,
    arch,
    cpus: os.cpus().length,
    memory: os.totalmem(),
    gpuType: null,
    gpuVram: null,
    cudaVersion: null,
    mlxVersion: null,
    hostname: os.hostname(),
    macAddress: getMacAddress(),
    cpuModel: getCpuModel(),
    teeCapable: await detectTeeCapable(),
    containerRuntime: await detectContainerRuntime(),
  };

  // Try NVIDIA first (works on Linux and Windows)
  const nvidia = await detectNvidiaGpu();
  if (nvidia) {
    return {
      ...baseInfo,
      gpuType: nvidia.type,
      gpuVram: nvidia.vram,
      cudaVersion: nvidia.cudaVersion,
    };
  }

  // Try AMD ROCm (Linux only)
  if (platform === 'linux') {
    const amd = await detectAmdGpu();
    if (amd) {
      return {
        ...baseInfo,
        gpuType: amd.type,
        gpuVram: amd.vram,
      };
    }
  }

  // Try Apple Silicon MLX
  if (platform === 'darwin' && arch === 'arm64') {
    const mlx = await detectMlx();
    const unifiedMemory = getAppleSiliconMemory();
    const chipName = await getAppleSiliconChip();

    return {
      ...baseInfo,
      gpuType: chipName,
      gpuVram: unifiedMemory,
      mlxVersion: mlx?.version ?? null,
    };
  }

  return baseInfo;
}

/**
 * Generate hardware hash for attestation (bytes32)
 */
export function generateHardwareHash(info: HardwareInfo): string {
  const data = JSON.stringify({
    platform: info.platform,
    arch: info.arch,
    gpuType: info.gpuType,
    gpuVram: info.gpuVram,
    cudaVersion: info.cudaVersion,
    mlxVersion: info.mlxVersion,
    macAddress: info.macAddress,
  });

  // Use crypto hasher for proper bytes32
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return '0x' + hasher.digest('hex');
}

/**
 * Format hardware info for display
 */
export function formatHardwareInfo(info: HardwareInfo): string {
  const lines: string[] = [];
  
  lines.push(`Platform: ${info.platform}/${info.arch}`);
  lines.push(`Hostname: ${info.hostname ?? 'unknown'}`);
  lines.push(`MAC: ${info.macAddress ?? 'unknown'}`);
  lines.push(`CPU: ${info.cpuModel ?? 'unknown'} (${info.cpus} cores)`);
  lines.push(`Memory: ${Math.round(info.memory / 1024 / 1024 / 1024)}GB`);
  
  if (info.gpuType) {
    lines.push(`GPU: ${info.gpuType}`);
    if (info.gpuVram) {
      lines.push(`  VRAM: ${Math.round(info.gpuVram / 1024 / 1024 / 1024)}GB`);
    }
    if (info.cudaVersion) {
      lines.push(`  CUDA: ${info.cudaVersion}`);
    }
    if (info.mlxVersion) {
      lines.push(`  MLX: ${info.mlxVersion}`);
    }
  }
  
  lines.push(`TEE Capable: ${info.teeCapable ? 'yes' : 'no'}`);
  lines.push(`Container: ${info.containerRuntime ?? 'none'}`);
  
  return lines.join('\n');
}
