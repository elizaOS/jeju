/**
 * Hardware detection for compute nodes
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
 * Detect hardware capabilities
 */
export async function detectHardware(): Promise<HardwareInfo> {
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const arch = process.arch as 'arm64' | 'x64';

  const baseInfo: HardwareInfo = {
    platform,
    arch,
    cpus: os.cpus().length,
    memory: os.totalmem(),
    gpuType: null,
    gpuVram: null,
    cudaVersion: null,
    mlxVersion: null,
  };

  // Try NVIDIA first
  const nvidia = await detectNvidiaGpu();
  if (nvidia) {
    return {
      ...baseInfo,
      gpuType: nvidia.type,
      gpuVram: nvidia.vram,
      cudaVersion: nvidia.cudaVersion,
    };
  }

  // Try Apple MLX
  if (platform === 'darwin' && arch === 'arm64') {
    const mlx = await detectMlx();
    const unifiedMemory = getAppleSiliconMemory();

    if (mlx) {
      // Detect specific chip
      let chipName = 'Apple Silicon';
      try {
        const output = await exec('sysctl', ['-n', 'machdep.cpu.brand_string']);
        chipName = output.trim();
      } catch {
        // Fallback
      }

      return {
        ...baseInfo,
        gpuType: chipName,
        gpuVram: unifiedMemory,
        mlxVersion: mlx.version,
      };
    }
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
  });

  // Use crypto hasher for proper bytes32
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return '0x' + hasher.digest('hex');
}
