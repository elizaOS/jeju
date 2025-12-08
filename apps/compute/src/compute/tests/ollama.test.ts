/**
 * Ollama Inference Engine Tests
 *
 * Tests the OllamaInferenceEngine with mocked HTTP responses
 * so we can verify the logic without requiring a real Ollama server.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { OllamaInferenceEngine } from '../node/inference';
import type { ChatCompletionRequest, ModelConfig } from '../node/types';

// Mock Ollama response
const MOCK_OLLAMA_RESPONSE = {
  model: 'llama2',
  created_at: '2024-01-01T00:00:00Z',
  message: {
    role: 'assistant',
    content: 'Hello! How can I help you today?',
  },
  done: true,
  total_duration: 1234567890,
  load_duration: 12345678,
  prompt_eval_count: 10,
  prompt_eval_duration: 12345678,
  eval_count: 15,
  eval_duration: 12345678,
};

// Mock streaming response chunks
const MOCK_STREAM_CHUNKS = [
  { message: { content: 'Hello' }, done: false },
  { message: { content: '!' }, done: false },
  { message: { content: ' How' }, done: false },
  { message: { content: ' can' }, done: false },
  { message: { content: ' I' }, done: false },
  { message: { content: ' help?' }, done: true },
];

describe('Ollama Inference Engine', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Non-streaming completion', () => {
    test('makes correct request to Ollama', async () => {
      let capturedRequest: {
        url: string;
        body: Record<string, unknown>;
      } | null = null;

      // Mock fetch
      global.fetch = mock(async (url, options) => {
        capturedRequest = {
          url: url.toString(),
          body: JSON.parse((options as RequestInit).body as string),
        };
        return new Response(JSON.stringify(MOCK_OLLAMA_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      const config: ModelConfig = {
        name: 'llama2',
        backend: 'ollama',
        endpoint: 'http://localhost:11434',
        pricePerInputToken: BigInt(1000),
        pricePerOutputToken: BigInt(2000),
        maxContextLength: 4096,
      };

      const engine = new OllamaInferenceEngine(config);

      const request: ChatCompletionRequest = {
        model: 'llama2',
        messages: [{ role: 'user', content: 'Hello!' }],
        temperature: 0.7,
        max_tokens: 100,
      };

      const response = await engine.complete(request);

      // Verify request was made correctly
      expect(capturedRequest).not.toBeNull();
      if (!capturedRequest) throw new Error('capturedRequest is null');
      expect(capturedRequest.url).toBe('http://localhost:11434/api/chat');
      expect(capturedRequest.body.model).toBe('llama2');
      expect(capturedRequest.body.messages).toEqual([
        { role: 'user', content: 'Hello!' },
      ]);
      expect(capturedRequest.body.stream).toBe(false);

      // Verify response is formatted correctly
      expect(response.model).toBe('llama2');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]?.message.role).toBe('assistant');
      expect(response.choices[0]?.message.content).toBe(
        'Hello! How can I help you today?'
      );
      expect(response.usage.prompt_tokens).toBe(10);
      expect(response.usage.completion_tokens).toBe(15);
    });

    test('handles Ollama error response', async () => {
      global.fetch = mock(async () => {
        return new Response('Model not found', {
          status: 404,
          statusText: 'Not Found',
        });
      }) as unknown as typeof fetch;

      const config: ModelConfig = {
        name: 'nonexistent',
        backend: 'ollama',
        pricePerInputToken: BigInt(1000),
        pricePerOutputToken: BigInt(2000),
        maxContextLength: 4096,
      };

      const engine = new OllamaInferenceEngine(config);

      await expect(
        engine.complete({
          model: 'nonexistent',
          messages: [{ role: 'user', content: 'Hello!' }],
        })
      ).rejects.toThrow('Ollama error: 404');
    });
  });

  describe('Streaming completion', () => {
    test('streams chunks correctly', async () => {
      // Create a readable stream from mock chunks
      const encoder = new TextEncoder();
      const streamData = MOCK_STREAM_CHUNKS.map((c) => JSON.stringify(c)).join(
        '\n'
      );

      global.fetch = mock(async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(streamData));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' },
        });
      }) as unknown as typeof fetch;

      const config: ModelConfig = {
        name: 'llama2',
        backend: 'ollama',
        pricePerInputToken: BigInt(1000),
        pricePerOutputToken: BigInt(2000),
        maxContextLength: 4096,
      };

      const engine = new OllamaInferenceEngine(config);

      const request: ChatCompletionRequest = {
        model: 'llama2',
        messages: [{ role: 'user', content: 'Hello!' }],
        stream: true,
      };

      const chunks: string[] = [];
      let hasRole = false;
      let hasDone = false;

      for await (const chunk of engine.stream(request)) {
        const choice = chunk.choices[0];
        if (choice?.delta.role) {
          hasRole = true;
        }
        if (choice?.delta.content) {
          chunks.push(choice.delta.content);
        }
        if (choice?.finish_reason === 'stop') {
          hasDone = true;
        }
      }

      // First chunk should have role
      expect(hasRole).toBe(true);

      // Should have content chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Last chunk should have stop
      expect(hasDone).toBe(true);
    });

    test('handles stream error', async () => {
      global.fetch = mock(async () => {
        return new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
        });
      }) as unknown as typeof fetch;

      const config: ModelConfig = {
        name: 'llama2',
        backend: 'ollama',
        pricePerInputToken: BigInt(1000),
        pricePerOutputToken: BigInt(2000),
        maxContextLength: 4096,
      };

      const engine = new OllamaInferenceEngine(config);

      await expect(async () => {
        for await (const _ of engine.stream({
          model: 'llama2',
          messages: [{ role: 'user', content: 'Hello!' }],
          stream: true,
        })) {
          // Should throw before yielding
        }
      }).toThrow('Ollama error: 500');
    });
  });

  describe('Token counting', () => {
    test('uses real GPT tokenizer', () => {
      const config: ModelConfig = {
        name: 'llama2',
        backend: 'ollama',
        pricePerInputToken: BigInt(1000),
        pricePerOutputToken: BigInt(2000),
        maxContextLength: 4096,
      };

      const engine = new OllamaInferenceEngine(config);

      // "Hello, world!" is typically 4 tokens
      const count = engine.countTokens('Hello, world!');

      // Should be close to 4, not text.length/4 = 3
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);

      // Longer text should have more tokens
      const longText = 'The quick brown fox jumps over the lazy dog.';
      const longCount = engine.countTokens(longText);

      // Should be around 10 tokens, not 44/4 = 11
      expect(longCount).toBeGreaterThanOrEqual(8);
      expect(longCount).toBeLessThanOrEqual(12);
    });
  });
});
