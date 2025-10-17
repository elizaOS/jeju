# Deployment Prerequisites

Requirements before deploying your own Jeju instance.

## Technical Requirements

### Hardware (Minimum)
- 8+ CPU cores
- 32+ GB RAM
- 500+ GB SSD storage
- 100+ Mbps network

### Software
- Docker & Docker Compose
- Kubernetes (for production)
- Helm 3+
- Foundry
- Bun or Node.js 18+

### Cloud (Recommended)
- AWS/GCP/Azure account
- Domain name for RPC endpoints
- SSL certificates (via cert-manager)

## Financial Requirements

### Testnet (~$500/month)
- AWS infrastructure: $300
- Base Sepolia gas: ~$50
- Monitoring: $50
- Contingency: $100

### Mainnet (~$6,000/month + $60k initial)
- AWS infrastructure: $3,000
- Base settlement costs: $750
- EigenDA: $300
- Monitoring: $200
- Other services: $750

**Initial Capital**:
- Deployer ETH: $10,000
- Batcher ETH: $30,000
- Proposer ETH: $10,000
- Emergency fund: $10,000

## Technical Skills

### Required
- Blockchain infrastructure experience
- Linux system administration
- Kubernetes/Docker knowledge
- Solidity/smart contracts
- 24/7 operations capability

### Recommended
- DevOps/SRE experience
- Security best practices
- Incident response training

## Before You Start

### Checklist
- [ ] Hardware meets requirements
- [ ] Cloud account configured
- [ ] Domain names registered
- [ ] Capital available
- [ ] Team trained
- [ ] 24/7 on-call rotation ready
- [ ] Incident response plan documented

## Next Steps

- [Deployment Overview](./overview.md)
- [Testnet Deployment](./testnet.md)
- [Mainnet Deployment](./mainnet.md)

