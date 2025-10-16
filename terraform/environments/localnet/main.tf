# Localnet environment (for testing Terraform locally, actual localnet uses Kurtosis)

terraform {
  required_version = ">= 1.6.0"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "jeju-l2"
      Environment = "localnet"
      ManagedBy   = "terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# Network module
module "network" {
  source = "../../modules/network"

  environment        = "localnet"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = var.availability_zones
}

# EKS module
module "eks" {
  source = "../../modules/eks"

  environment         = "localnet"
  cluster_version     = "1.29"
  vpc_id              = module.network.vpc_id
  private_subnet_ids  = module.network.private_subnet_ids
  public_subnet_ids   = module.network.public_subnet_ids

  node_groups = [
    {
      name          = "core"
      instance_type = "t3.xlarge"
      min_size      = 1
      max_size      = 3
      desired_size  = 2
      disk_size     = 50
      labels        = { role = "core" }
      taints        = []
    },
    {
      name          = "rpc"
      instance_type = "t3.xlarge"
      min_size      = 1
      max_size      = 5
      desired_size  = 2
      disk_size     = 100
      labels        = { role = "rpc" }
      taints        = []
    }
  ]
}

# RDS module
module "rds" {
  source = "../../modules/rds"

  environment        = "localnet"
  vpc_id             = module.network.vpc_id
  data_subnet_ids    = module.network.data_subnet_ids
  instance_class     = "db.t4g.large"
  allocated_storage  = 50
  max_allocated_storage = 100
  multi_az           = false
  backup_retention_period = 1
}

# KMS module
module "kms" {
  source = "../../modules/kms"

  environment = "localnet"
}

# Vault module
module "vault" {
  source = "../../modules/vault"

  environment       = "localnet"
  namespace         = "infra"
  replicas          = 1
  vault_kms_key_id  = module.kms.vault_key_id
  storage_size      = "5Gi"
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_provider_url = module.eks.cluster_oidc_issuer_url
}

# Outputs
output "vpc_id" {
  value = module.network.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value = module.rds.db_endpoint
}

output "vault_role_arn" {
  value = module.vault.vault_role_arn
}


