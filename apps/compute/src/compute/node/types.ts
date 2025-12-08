/**
 * Types for the compute node
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  seed?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
}

export interface StreamChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamChoice[];
}

export interface HardwareInfo {
  platform: 'darwin' | 'linux' | 'win32';
  arch: 'arm64' | 'x64';
  cpus: number;
  memory: number;
  gpuType: string | null;
  gpuVram: number | null;
  cudaVersion: string | null;
  mlxVersion: string | null;
}

export interface AttestationReport {
  signingAddress: string;
  hardware: HardwareInfo;
  timestamp: string;
  nonce: string;
  signature: string;
  simulated: boolean;
}

export interface ProviderConfig {
  privateKey: string;
  registryAddress: string;
  ledgerAddress: string;
  inferenceAddress: string;
  rpcUrl: string;
  port: number;
  models: ModelConfig[];
}

export interface ModelConfig {
  name: string;
  backend: 'ollama' | 'llamacpp' | 'mock';
  endpoint?: string;
  pricePerInputToken: bigint;
  pricePerOutputToken: bigint;
  maxContextLength: number;
}

export interface AuthHeaders {
  'x-jeju-address': string;
  'x-jeju-nonce': string;
  'x-jeju-signature': string;
  'x-jeju-timestamp': string;
}
