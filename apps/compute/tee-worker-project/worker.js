// Babylon Game Worker - Runs in Marlin Oyster TEE
// This code is executed in AWS Nitro Enclaves via Workerd

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          tee: 'marlin-oyster',
          timestamp: Date.now(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/execute' && request.method === 'POST') {
      try {
        const body = await request.json();

        // Execute game action in TEE
        const result = await this.executeGameAction(body);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (url.pathname === '/attestation') {
      // Return TEE attestation document
      // In real Nitro Enclave, this calls /dev/attestation
      return new Response(
        JSON.stringify({
          platform: 'aws-nitro',
          pcrs: {
            // PCR values would come from actual enclave
            pcr0: 'placeholder',
            pcr1: 'placeholder',
            pcr2: 'placeholder',
          },
          timestamp: Date.now(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Babylon TEE Worker', { status: 200 });
  },

  async executeGameAction(params) {
    const { action, gameState: _gameState, playerId } = params;

    // Deterministic game logic runs here
    // Results can be verified via attestation

    const result = {
      action,
      playerId,
      processed: true,
      timestamp: Date.now(),
      // Hash of inputs for verification
      inputHash: await this.hashInputs(params),
    };

    return result;
  },

  async hashInputs(data) {
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(dataStr)
    );
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },
};
