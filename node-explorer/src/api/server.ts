#!/usr/bin/env bun
/**
 * @title Node Explorer API
 * @notice Backend API for tracking Jeju node operators
 * 
 * Endpoints:
 * - GET /nodes - List all nodes
 * - GET /nodes/:id - Get specific node
 * - POST /nodes/register - Register a new node
 * - POST /nodes/heartbeat - Submit node health data
 * - GET /stats - Network statistics
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import Database from 'better-sqlite3';
import { ethers } from 'ethers';

// ============ Database Setup ============

const db = new Database('node-explorer.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    operator_address TEXT NOT NULL,
    rpc_url TEXT NOT NULL,
    ws_url TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL,
    version TEXT,
    first_seen INTEGER NOT NULL,
    last_heartbeat INTEGER NOT NULL,
    uptime_score REAL DEFAULT 1.0,
    total_requests INTEGER DEFAULT 0,
    status TEXT DEFAULT 'online',
    UNIQUE(operator_address, rpc_url)
  );

  CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    block_number INTEGER,
    peer_count INTEGER,
    is_syncing INTEGER,
    response_time REAL,
    FOREIGN KEY(node_id) REFERENCES nodes(id)
  );

  CREATE TABLE IF NOT EXISTS node_stats (
    date TEXT PRIMARY KEY,
    total_nodes INTEGER,
    active_nodes INTEGER,
    total_requests INTEGER,
    avg_uptime REAL
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeats_node ON heartbeats(node_id);
  CREATE INDEX IF NOT EXISTS idx_heartbeats_time ON heartbeats(timestamp);
  CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
`);

// ============ Types ============

interface Node {
  id: string;
  operator_address: string;
  rpc_url: string;
  ws_url?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  version?: string;
  first_seen: number;
  last_heartbeat: number;
  uptime_score: number;
  total_requests: number;
  status: 'online' | 'offline' | 'syncing';
}

interface Heartbeat {
  node_id: string;
  timestamp: number;
  block_number?: number;
  peer_count?: number;
  is_syncing: boolean;
  response_time?: number;
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

// ============ Hono App ============

const app = new Hono();

// Middleware
app.use('/*', cors());

// ============ Endpoints ============

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// List all nodes
app.get('/nodes', (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  
  let query = 'SELECT * FROM nodes';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY uptime_score DESC, last_heartbeat DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const stmt = db.prepare(query);
  const nodes = stmt.all(...params);
  
  return c.json({
    nodes,
    total: db.prepare('SELECT COUNT(*) as count FROM nodes').get() as any,
  });
});

// Get specific node
app.get('/nodes/:id', (c) => {
  const id = c.req.param('id');
  
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  
  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }
  
  // Get recent heartbeats
  const heartbeats = db.prepare(`
    SELECT * FROM heartbeats 
    WHERE node_id = ? 
    ORDER BY timestamp DESC 
    LIMIT 100
  `).all(id);
  
  return c.json({ node, heartbeats });
});

// Register new node
app.post('/nodes/register', async (c) => {
  const body = await c.req.json();
  
  const {
    operator_address,
    rpc_url,
    ws_url,
    location,
    latitude,
    longitude,
    version,
    signature,
  } = body;
  
  // Verify signature
  try {
    const message = `Register node: ${rpc_url}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== operator_address.toLowerCase()) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch (error) {
    return c.json({ error: 'Invalid signature format' }, 401);
  }
  
  // Generate node ID
  const nodeId = ethers.id(`${operator_address}-${rpc_url}`).slice(0, 18);
  const now = Math.floor(Date.now() / 1000);
  
  try {
    db.prepare(`
      INSERT INTO nodes (
        id, operator_address, rpc_url, ws_url, location, 
        latitude, longitude, version, first_seen, last_heartbeat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(operator_address, rpc_url) DO UPDATE SET
        ws_url = excluded.ws_url,
        location = excluded.location,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        version = excluded.version,
        last_heartbeat = excluded.last_heartbeat
    `).run(
      nodeId, operator_address, rpc_url, ws_url, location,
      latitude, longitude, version, now, now
    );
    
    return c.json({ 
      success: true, 
      node_id: nodeId,
      message: 'Node registered successfully',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Submit heartbeat
app.post('/nodes/heartbeat', async (c) => {
  const body = await c.req.json();
  
  const {
    node_id,
    block_number,
    peer_count,
    is_syncing,
    response_time,
    signature,
  } = body;
  
  // Verify node exists
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(node_id) as Node | undefined;
  
  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }
  
  // Verify signature
  try {
    const message = `Heartbeat: ${node_id}:${Date.now()}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== node.operator_address.toLowerCase()) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch (error) {
    return c.json({ error: 'Invalid signature format' }, 401);
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // Insert heartbeat
  db.prepare(`
    INSERT INTO heartbeats (
      node_id, timestamp, block_number, peer_count, is_syncing, response_time
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(node_id, now, block_number, peer_count, is_syncing ? 1 : 0, response_time);
  
  // Update node status
  const status = is_syncing ? 'syncing' : 'online';
  db.prepare(`
    UPDATE nodes 
    SET last_heartbeat = ?, status = ?
    WHERE id = ?
  `).run(now, status, node_id);
  
  // Calculate uptime score (based on heartbeat consistency)
  const recentHeartbeats = db.prepare(`
    SELECT COUNT(*) as count 
    FROM heartbeats 
    WHERE node_id = ? AND timestamp > ?
  `).get(node_id, now - 86400) as any; // Last 24 hours
  
  // Expected: 1 heartbeat every 5 minutes = 288 per day
  const expectedHeartbeats = 288;
  const uptimeScore = Math.min(1.0, recentHeartbeats.count / expectedHeartbeats);
  
  db.prepare('UPDATE nodes SET uptime_score = ? WHERE id = ?').run(uptimeScore, node_id);
  
  return c.json({ 
    success: true,
    uptime_score: uptimeScore,
  });
});

// Network statistics
app.get('/stats', (c) => {
  const totalNodes = (db.prepare('SELECT COUNT(*) as count FROM nodes').get() as any).count;
  
  const activeNodes = (db.prepare(`
    SELECT COUNT(*) as count FROM nodes 
    WHERE last_heartbeat > ?
  `).get(Math.floor(Date.now() / 1000) - 300) as any).count; // Last 5 minutes
  
  const totalRequests = (db.prepare(`
    SELECT SUM(total_requests) as sum FROM nodes
  `).get() as any).sum || 0;
  
  const avgUptime = (db.prepare(`
    SELECT AVG(uptime_score) as avg FROM nodes
  `).get() as any).avg || 0;
  
  const avgResponseTime = (db.prepare(`
    SELECT AVG(response_time) as avg FROM heartbeats
    WHERE timestamp > ?
  `).get(Math.floor(Date.now() / 1000) - 3600) as any).avg || 0;
  
  // Geographic distribution
  const geoDistribution = db.prepare(`
    SELECT location, COUNT(*) as count 
    FROM nodes 
    WHERE location IS NOT NULL
    GROUP BY location
  `).all() as any[];
  
  const geographicDistribution: Record<string, number> = {};
  geoDistribution.forEach(row => {
    geographicDistribution[row.location] = row.count;
  });
  
  // Version distribution
  const versionDist = db.prepare(`
    SELECT version, COUNT(*) as count 
    FROM nodes 
    WHERE version IS NOT NULL
    GROUP BY version
  `).all() as any[];
  
  const versionDistribution: Record<string, number> = {};
  versionDist.forEach(row => {
    versionDistribution[row.version] = row.count;
  });
  
  const stats: NetworkStats = {
    totalNodes,
    activeNodes,
    totalRequests,
    avgUptime: parseFloat(avgUptime.toFixed(4)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
    geographicDistribution,
    versionDistribution,
  };
  
  return c.json(stats);
});

// Get historical data
app.get('/history', (c) => {
  const days = parseInt(c.req.query('days') || '30');
  
  const history = db.prepare(`
    SELECT * FROM node_stats 
    ORDER BY date DESC 
    LIMIT ?
  `).all(days);
  
  return c.json({ history });
});

// ============ Background Jobs ============

// Mark offline nodes
setInterval(() => {
  const threshold = Math.floor(Date.now() / 1000) - 600; // 10 minutes
  
  db.prepare(`
    UPDATE nodes 
    SET status = 'offline' 
    WHERE last_heartbeat < ? AND status != 'offline'
  `).run(threshold);
}, 60000); // Every minute

// Aggregate daily stats
setInterval(() => {
  const today = new Date().toISOString().split('T')[0];
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_nodes,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as active_nodes,
      SUM(total_requests) as total_requests,
      AVG(uptime_score) as avg_uptime
    FROM nodes
  `).get() as any;
  
  db.prepare(`
    INSERT OR REPLACE INTO node_stats (date, total_nodes, active_nodes, total_requests, avg_uptime)
    VALUES (?, ?, ?, ?, ?)
  `).run(today, stats.total_nodes, stats.active_nodes, stats.total_requests, stats.avg_uptime);
}, 3600000); // Every hour

// ============ Start Server ============

const PORT = parseInt(process.env.PORT || '3002');

console.log('🚀 Node Explorer API starting...');
console.log(`   Port: ${PORT}`);
console.log(`   Database: node-explorer.db`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`);
});

export { app };

