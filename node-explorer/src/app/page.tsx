'use client';

import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

interface Node {
  id: string;
  operator_address: string;
  rpc_url: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  version?: string;
  last_heartbeat: number;
  uptime_score: number;
  status: 'online' | 'offline' | 'syncing';
}

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalRequests: number;
  avgUptime: number;
  avgResponseTime: number;
  geographicDistribution: Record<string, number>;
  versionDistribution: Record<string, number>;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const { data: stats } = useQuery<NetworkStats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/stats`);
      return res.json();
    },
    refetchInterval: 30000, // 30 seconds
  });

  const { data: nodesData } = useQuery<{ nodes: Node[]; total: number }>({
    queryKey: ['nodes'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/nodes?limit=100`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: history } = useQuery<{ history: any[] }>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/history?days=30`);
      return res.json();
    },
    refetchInterval: 300000, // 5 minutes
  });

  const nodes = nodesData?.nodes || [];
  const activeNodes = nodes.filter(n => n.status === 'online');

  // Prepare geographic data for pie chart
  const geoData = stats?.geographicDistribution 
    ? Object.entries(stats.geographicDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // Prepare version data for pie chart
  const versionData = stats?.versionDistribution
    ? Object.entries(stats.versionDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // Prepare history data for line chart
  const historyData = history?.history?.slice().reverse().map(h => ({
    date: h.date,
    nodes: h.total_nodes,
    active: h.active_nodes,
    uptime: (h.avg_uptime * 100).toFixed(1),
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Jeju Network Explorer
              </h1>
              <p className="text-gray-400 mt-1">Decentralized Node Operator Dashboard</p>
            </div>
            <a
              href="/register"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all"
            >
              Register Node
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Total Nodes"
            value={stats?.totalNodes || 0}
            icon="🖥️"
            color="blue"
          />
          <StatCard
            title="Active Now"
            value={stats?.activeNodes || 0}
            icon="✅"
            color="green"
          />
          <StatCard
            title="Avg Uptime"
            value={`${((stats?.avgUptime || 0) * 100).toFixed(1)}%`}
            icon="⚡"
            color="yellow"
          />
          <StatCard
            title="Avg Response"
            value={`${stats?.avgResponseTime.toFixed(0)}ms`}
            icon="⏱️"
            color="purple"
          />
          <StatCard
            title="Total Requests"
            value={formatNumber(stats?.totalRequests || 0)}
            icon="📊"
            color="pink"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Historical Data */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Network Growth (30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                />
                <Line type="monotone" dataKey="nodes" stroke="#3b82f6" strokeWidth={2} name="Total Nodes" />
                <Line type="monotone" dataKey="active" stroke="#10b981" strokeWidth={2} name="Active Nodes" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Geographic Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={geoData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {geoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Map */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-4">Live Node Map</h3>
          <div className="h-96 rounded-lg overflow-hidden">
            {typeof window !== 'undefined' && (
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {nodes
                  .filter(node => node.latitude && node.longitude)
                  .map(node => (
                    <Marker key={node.id} position={[node.latitude!, node.longitude!]}>
                      <Popup>
                        <div className="text-gray-900">
                          <p className="font-bold">{node.location}</p>
                          <p className="text-sm">Status: {node.status}</p>
                          <p className="text-sm">Uptime: {(node.uptime_score * 100).toFixed(1)}%</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Node List */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold mb-4">Active Node Operators</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">Operator</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Version</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Uptime</th>
                  <th className="text-left py-3 px-4">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {nodes.slice(0, 20).map(node => (
                  <tr key={node.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4 font-mono text-sm">
                      {node.operator_address.slice(0, 6)}...{node.operator_address.slice(-4)}
                    </td>
                    <td className="py-3 px-4">{node.location || 'Unknown'}</td>
                    <td className="py-3 px-4">{node.version || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        node.status === 'online' ? 'bg-green-500/20 text-green-400' :
                        node.status === 'syncing' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {node.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{(node.uptime_score * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {formatTimestamp(node.last_heartbeat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function StatCard({ title, value, icon, color }: any) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <p className="text-sm opacity-90">{title}</p>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

