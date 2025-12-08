# Installation

## Requirements

- RAM: 16GB min, 32GB recommended
- Storage: 50GB free
- CPU: 4+ cores
- OS: macOS, Linux, or Windows WSL2

## macOS

```bash
brew install --cask docker
brew install kurtosis-tech/tap/kurtosis
curl -fsSL https://bun.sh/install | bash
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Verify
docker --version && kurtosis version && bun --version && cast --version
```

## Linux (Ubuntu/Debian)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Kurtosis
echo "deb [trusted=yes] https://apt.fury.io/kurtosis-tech/ /" | sudo tee /etc/apt/sources.list.d/kurtosis.list
sudo apt-get update && sudo apt-get install -y kurtosis-cli

# Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

## Windows

1. Enable WSL2: `wsl --install` (PowerShell as Admin)
2. Install Docker Desktop with WSL2 backend
3. Follow Linux instructions inside WSL2

## Docker Resources

For macOS/Windows Docker Desktop, set:
- Memory: 8GB min, 16GB recommended
- CPUs: 4 min, 8 recommended
- Disk: 50GB min

## Verify

```bash
docker ps              # Docker running
kurtosis engine start  # Kurtosis engine
kurtosis engine status # Should show "Running"
```

## Next Steps

[Quick Start](./quick-start) - Run Jeju locally
