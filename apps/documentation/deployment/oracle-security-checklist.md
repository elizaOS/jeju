# Oracle Security Checklist

## Infrastructure

- [ ] Dedicated cloud accounts with MFA
- [ ] Bots in different regions/providers
- [ ] Infrastructure-as-code (Terraform)

## Key Management

- [ ] Separate key per bot
- [ ] Secrets in AWS Secrets Manager/Vault
- [ ] Bot can only call `updatePrices()` (not admin functions)
- [ ] Rotate keys every 3-6 months

## Access

- [ ] SSH key-only (disable passwords)
- [ ] Bastion host for access
- [ ] Audit logging enabled

## Network

```bash
ufw enable
ufw default deny incoming
ufw allow from ADMIN_IP to any port 22 proto tcp
ufw allow from MONITORING_IP to any port 3000 proto tcp
```

- [ ] Fail2ban installed
- [ ] DDoS protection (Cloudflare)
- [ ] 3+ RPC providers with failover

## Runtime

```ini
# systemd hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
MemoryMax=512M
```

- [ ] Price sanity checks (ETH: $500-$10k, elizaOS: $0.000001-$10k)
- [ ] 50% max deviation per update
- [ ] 1 update/min rate limit

## Monitoring

- [ ] Comprehensive logging (ELK/Loki)
- [ ] PagerDuty for critical alerts
- [ ] Monitor for compromise indicators (unexpected txs, config changes)
- [ ] Weekly vulnerability scans

## Incident Response

**Bot compromise:**
1. Stop bot
2. Revoke oracle update permission
3. Generate new key
4. Redeploy

**Oracle manipulation:**
1. Pause oracle
2. Investigate
3. Emergency update if needed
4. Resume

## Security Verification

```bash
sudo ufw status verbose
sudo ss -tulpn
ls -la /opt/jeju-oracle/.env  # Should be 600
systemctl show jeju-oracle | grep NoNewPrivileges
```
