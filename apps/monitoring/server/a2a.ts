/**
 * @fileoverview A2A (Agent-to-Agent) server for Jeju network monitoring
 * @module monitoring/server/a2a
 * 
 * Exposes Prometheus metrics and network health status via the A2A protocol,
 * enabling AI agents to programmatically query blockchain network metrics.
 * 
 * Features:
 * - Execute PromQL queries against Prometheus
 * - Retrieve active alerts and their status
 * - Query scrape targets health
 * - Get network performance metrics
 * 
 * @example Query metrics from an agent
 * ```typescript
 * const response = await fetch('http://localhost:9091/api/a2a', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     jsonrpc: '2.0',
 *     method: 'message/send',
 *     params: {
 *       message: {
 *         messageId: 'msg-123',
 *         parts: [{
 *           kind: 'data',
 *           data: {
 *             skillId: 'query-metrics',
 *             query: 'rate(http_requests_total[5m])'
 *           }
 *         }]
 *       }
 *     },
 *     id: 1
 *   })
 * });
 * ```
 */

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';

app.get('/.well-known/agent-card.json', (_req, res) => {
  res.json({
    protocolVersion: '0.3.0',
    name: 'Jeju Monitoring',
    description: 'Query blockchain metrics and system health via Prometheus',
    url: 'http://localhost:9091/api/a2a',
    preferredTransport: 'http',
    provider: { organization: 'Jeju Network', url: 'https://jeju.network' },
    version: '1.0.0',
    capabilities: { 
      streaming: false, 
      pushNotifications: false, 
      stateTransitionHistory: false 
    },
    defaultInputModes: ['text', 'data'],
    defaultOutputModes: ['text', 'data'],
    skills: [
      { 
        id: 'query-metrics', 
        name: 'Query Metrics', 
        description: 'Execute PromQL query against Prometheus', 
        tags: ['query', 'metrics'], 
        examples: ['Show current TPS', 'Get block production rate', 'Check system health'] 
      },
      { 
        id: 'get-alerts', 
        name: 'Get Alerts', 
        description: 'Get currently firing alerts', 
        tags: ['alerts', 'monitoring'], 
        examples: ['Show active alerts', 'Are there any critical issues?'] 
      },
      { 
        id: 'get-targets', 
        name: 'Get Targets', 
        description: 'Get Prometheus scrape targets and their status', 
        tags: ['targets', 'health'], 
        examples: ['Show scrape targets', 'Which services are being monitored?'] 
      }
    ]
  });
});

app.post('/api/a2a', async (req, res) => {
  const { method, params, id } = req.body;
  if (method !== 'message/send') {
    return res.json({ 
      jsonrpc: '2.0', 
      id, 
      error: { code: -32601, message: 'Method not found' } 
    });
  }

  interface MessagePart {
    kind: string;
    data?: { skillId?: string; query?: string };
  }
  interface Message {
    messageId: string;
    parts: MessagePart[];
  }

  const message = params?.message as Message | undefined;
  const dataPart = message?.parts.find((p: MessagePart) => p.kind === 'data');
  const skillId = dataPart?.data?.skillId;
  const query = dataPart?.data?.query;

  let result;
  try {
    switch (skillId) {
      case 'query-metrics': {
        if (!query) {
          result = { message: 'Missing PromQL query', data: { error: 'query required' } };
          break;
        }
        
        const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        result = { 
          message: `Query results for: ${query}`, 
          data: data.data 
        };
        break;
      }

      case 'get-alerts': {
        interface PrometheusAlert {
          state: string;
          labels: Record<string, string>;
          annotations: Record<string, string>;
        }
        interface AlertsResponse {
          data?: { alerts?: PrometheusAlert[] };
        }
        
        const response = await fetch(`${PROMETHEUS_URL}/api/v1/alerts`);
        const data = await response.json() as AlertsResponse;
        
        const activeAlerts = data.data?.alerts?.filter((a: PrometheusAlert) => a.state === 'firing') || [];
        
        result = { 
          message: `Found ${activeAlerts.length} active alerts`, 
          data: { alerts: activeAlerts } 
        };
        break;
      }

      case 'get-targets': {
        interface PrometheusTarget {
          health: string;
          labels: Record<string, string>;
          lastScrape: string;
        }
        interface TargetsResponse {
          data?: { activeTargets?: PrometheusTarget[] };
        }
        
        const response = await fetch(`${PROMETHEUS_URL}/api/v1/targets`);
        const data = await response.json() as TargetsResponse;
        
        const targets = data.data?.activeTargets || [];
        const upCount = targets.filter((t: PrometheusTarget) => t.health === 'up').length;
        
        result = { 
          message: `${upCount}/${targets.length} targets healthy`, 
          data: { targets } 
        };
        break;
      }

      default:
        result = { message: 'Unknown skill', data: { error: 'invalid skillId' } };
    }
  } catch (error) {
    result = { 
      message: 'Query failed', 
      data: { error: error instanceof Error ? error.message : 'Unknown error' } 
    };
  }

  res.json({
    jsonrpc: '2.0',
    id,
    result: { 
      role: 'agent', 
      parts: [
        { kind: 'text', text: result.message }, 
        { kind: 'data', data: result.data }
      ], 
      messageId: message?.messageId ?? id, 
      kind: 'message' 
    }
  });
});

const PORT = 9091;
app.listen(PORT, () => console.log(`📊 Monitoring A2A: http://localhost:${PORT}`));

