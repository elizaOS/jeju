# Oracle Failover

Multi-bot with leader election. Lock timeout: 2 minutes.

## Automatic Failover

1. Leader stops updating
2. Lock file goes stale (>2 min)
3. Backup bot acquires lock, becomes leader
4. Original bot returns as follower

## Health Check

```bash
curl http://bot-1:3000/health
# Returns: status, botId, lastUpdate, consecutiveFailures
```

## Manual Failover

**Graceful (maintenance):**
```bash
ssh bot-1 "sudo systemctl stop jeju-oracle"
# Bot-2 takes over within 2 min
ssh bot-2 "sudo journalctl -u jeju-oracle -f"  # Verify
ssh bot-1 "sudo systemctl start jeju-oracle"   # Returns as follower
```

**Force:**
```bash
ssh bot-2 "sudo rm /tmp/oracle-bot-leader.lock"
ssh bot-1 "sudo systemctl stop jeju-oracle"
```

**Emergency manual update:**
```bash
cast send $ORACLE_ADDRESS "emergencyPriceUpdate(uint256,uint256)" \
  ETH_PRICE ELIZA_PRICE \
  --rpc-url $JEJU_RPC_URL --private-key $OWNER_KEY
```

## Recovery

**Bot crashed:**
```bash
sudo journalctl -u jeju-oracle -n 200
sudo systemctl restart jeju-oracle
```

**Network partition:**
```bash
# RPC failover is automatic
# If all RPCs down, add more to .env
```

## Alerts

- OracleBotDown: Bot not responding 2+ min
- AllOracleBotsDown: CRITICAL
- OraclePriceStale: No update in 1 hour
