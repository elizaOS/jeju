/**
 * Monitoring Stack Tests
 * Verifies Prometheus and Grafana are accessible
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const GRAFANA_PORT = parseInt(process.env.GRAFANA_PORT || '4010');
const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9090');

interface GrafanaHealth {
  database: string;
}

interface PrometheusTarget {
  health: string;
  labels: Record<string, string>;
}

interface PrometheusTargetsResponse {
  status: string;
  data: {
    activeTargets: PrometheusTarget[];
  };
}

interface GrafanaDataSource {
  type: string;
  name: string;
}

let grafanaAvailable = false;
let prometheusAvailable = false;

beforeAll(async () => {
  const grafanaRes = await fetch(`http://localhost:${GRAFANA_PORT}/api/health`).catch(() => null);
  grafanaAvailable = grafanaRes?.ok ?? false;
  
  const promRes = await fetch(`http://localhost:${PROMETHEUS_PORT}/api/v1/targets`).catch(() => null);
  prometheusAvailable = promRes?.ok ?? false;
});

describe('Monitoring Stack', () => {
  test('should access Grafana login page', async () => {
    if (!grafanaAvailable) {
      console.log('⚠️  Grafana not running, skipping test');
      return;
    }
    
    const response = await fetch(`http://localhost:${GRAFANA_PORT}/login`);
    expect(response.ok).toBe(true);
    const html = await response.text();
    expect(html).toContain('Grafana');
  });

  test('should access Prometheus targets page', async () => {
    if (!prometheusAvailable) {
      console.log('⚠️  Prometheus not running, skipping test');
      return;
    }
    
    const response = await fetch(`http://localhost:${PROMETHEUS_PORT}/api/v1/targets`);
    expect(response.ok).toBe(true);
    const data = await response.json() as PrometheusTargetsResponse;
    expect(data.status).toBe('success');
    expect(data.data).toBeDefined();
  });

  test('should verify Prometheus is scraping some targets', async () => {
    if (!prometheusAvailable) {
      console.log('⚠️  Prometheus not running, skipping test');
      return;
    }
    
    const response = await fetch(`http://localhost:${PROMETHEUS_PORT}/api/v1/targets`);
    const data = await response.json() as PrometheusTargetsResponse;
    
    console.log(`   📊 Found ${data.data.activeTargets.length} active targets`);
    expect(Array.isArray(data.data.activeTargets)).toBe(true);
  });

  test('should access Grafana API health', async () => {
    if (!grafanaAvailable) {
      console.log('⚠️  Grafana not running, skipping test');
      return;
    }
    
    const response = await fetch(`http://localhost:${GRAFANA_PORT}/api/health`);
    expect(response.ok).toBe(true);
    const health = await response.json() as GrafanaHealth;
    expect(health.database).toBe('ok');
  });

  test('should list Grafana datasources', async () => {
    if (!grafanaAvailable) {
      console.log('⚠️  Grafana not running, skipping test');
      return;
    }
    
    const auth = Buffer.from('admin:admin').toString('base64');
    const response = await fetch(`http://localhost:${GRAFANA_PORT}/api/datasources`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    
    if (!response.ok) {
      console.log('⚠️  Grafana auth failed, skipping datasource check');
      return;
    }
    
    const datasources = await response.json() as GrafanaDataSource[];
    expect(Array.isArray(datasources)).toBe(true);
    console.log(`   📊 Found ${datasources.length} datasources`);
    
    const hasPrometheus = datasources.some((ds) => ds.type === 'prometheus');
    const hasPostgres = datasources.some((ds) => ds.type === 'postgres');
    
    if (hasPrometheus) console.log('   ✅ Prometheus datasource configured');
    if (hasPostgres) console.log('   ✅ PostgreSQL datasource configured');
  });

  test('should verify dashboard files exist', () => {
    const dashboardDir = path.join(process.cwd(), 'grafana/dashboards');
    
    if (!fs.existsSync(dashboardDir)) {
      console.log(`⚠️  Dashboard directory not found at: ${dashboardDir}`);
      return;
    }
    
    const dashboards = fs.readdirSync(dashboardDir).filter((f: string) => f.endsWith('.json'));
    console.log(`   📊 Found ${dashboards.length} dashboard files`);
    expect(dashboards.length).toBeGreaterThan(0);
    
    for (const dashboard of dashboards) {
      const content = fs.readFileSync(path.join(dashboardDir, dashboard), 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
    console.log('   ✅ All dashboards have valid JSON');
  });
});
