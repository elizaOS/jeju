'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    rpcUrl: '',
    wsUrl: '',
    location: '',
    latitude: '',
    longitude: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Request wallet connection
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Sign message
      const message = `Register node: ${formData.rpcUrl}`;
      const signature = await signer.signMessage(message);

      // Submit registration
      const response = await fetch(`${API_URL}/nodes/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_address: address,
          rpc_url: formData.rpcUrl,
          ws_url: formData.wsUrl,
          location: formData.location,
          latitude: parseFloat(formData.latitude) || undefined,
          longitude: parseFloat(formData.longitude) || undefined,
          signature,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `Node registered successfully! Your node ID: ${data.node_id}`,
        });
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Registration failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Register Your Node
        </h1>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">RPC URL *</label>
              <input
                type="url"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://your-node-ip:8545"
                value={formData.rpcUrl}
                onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">WebSocket URL</label>
              <input
                type="url"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="wss://your-node-ip:8546"
                value={formData.wsUrl}
                onChange={(e) => setFormData({ ...formData, wsUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="North America, Europe, Asia, etc."
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="37.7749"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-122.4194"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Register Node'}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-500/20 border border-green-500 text-green-400'
                  : 'bg-red-500/20 border border-red-500 text-red-400'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        <div className="mt-8 text-gray-400 text-sm">
          <h3 className="font-semibold mb-2">Requirements:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>MetaMask or compatible wallet installed</li>
            <li>Running Jeju node with public RPC endpoint</li>
            <li>1,000 JEJU tokens for staking (for rewards)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

