# Jeju Network - AWS Testnet Environment
# Complete infrastructure orchestration

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "jeju-terraform-state-testnet"
    key            = "testnet/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "jeju-terraform-locks-testnet"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Jeju Network"
      Environment = "testnet"
      ManagedBy   = "Terraform"
      Repository  = "github.com/JejuNetwork/jeju"
    }
  }
}

# ============================================================
# Variables
# ============================================================
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

variable "domain_name" {
  description = "Base domain name"
  type        = string
  default     = "jeju.network"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1 for CloudFront)"
  type        = string
  default     = "" # Must be created manually first
}

locals {
  environment = "testnet"
  
  common_tags = {
    Project     = "Jeju Network"
    Environment = "testnet"
    ManagedBy   = "Terraform"
  }
}

# ============================================================
# Module: Networking (VPC, Subnets, NAT)
# ============================================================
module "network" {
  source = "../../modules/network"

  environment        = local.environment
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = var.availability_zones
  tags               = local.common_tags
}

# ============================================================
# Module: EKS Cluster
# ============================================================
module "eks" {
  source = "../../modules/eks"

  environment        = local.environment
  cluster_version    = "1.28"
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids

  node_groups = {
    # General purpose nodes
    general = {
      name           = "general"
      instance_types = ["t3.large"]
      desired_size   = 3
      min_size       = 2
      max_size       = 10
      disk_size      = 50
      labels = {
        workload = "general"
      }
    }

    # RPC nodes (need more resources)
    rpc = {
      name           = "rpc"
      instance_types = ["t3.xlarge"]
      desired_size   = 2
      min_size       = 1
      max_size       = 5
      disk_size      = 100
      labels = {
        workload = "rpc"
      }
      taints = [
        {
          key    = "workload"
          value  = "rpc"
          effect = "NoSchedule"
        }
      ]
    }

    # Indexer nodes
    indexer = {
      name           = "indexer"
      instance_types = ["t3.large"]
      desired_size   = 2
      min_size       = 1
      max_size       = 4
      disk_size      = 100
      labels = {
        workload = "indexer"
      }
    }
  }

  tags = local.common_tags
}

# ============================================================
# Module: RDS (PostgreSQL Databases)
# ============================================================
module "rds" {
  source = "../../modules/rds"

  environment              = local.environment
  vpc_id                   = module.network.vpc_id
  data_subnet_ids          = module.network.data_subnet_ids
  instance_class           = "db.t3.medium"
  allocated_storage        = 100
  max_allocated_storage    = 500
  engine_version           = "15.4"
  multi_az                 = true
  backup_retention_period  = 7
  tags                     = local.common_tags
}

# ============================================================
# Module: ECR (Container Registry)
# ============================================================
module "ecr" {
  source = "../../modules/ecr"

  environment = local.environment
  tags        = local.common_tags
}

# ============================================================
# Module: S3 + CloudFront (Static Frontends)
# ============================================================
module "cdn" {
  source = "../../modules/cdn"

  environment         = local.environment
  domain_name         = var.domain_name
  acm_certificate_arn = var.acm_certificate_arn

  apps = [
    { name = "gateway", subdomain = "gateway.testnet" },
    { name = "documentation", subdomain = "docs.testnet" }
  ]

  tags = local.common_tags
}

# ============================================================
# Module: ALB (Application Load Balancer)
# ============================================================
module "alb" {
  source = "../../modules/alb"

  environment         = local.environment
  vpc_id              = module.network.vpc_id
  public_subnet_ids   = module.network.public_subnet_ids
  acm_certificate_arn = var.acm_certificate_arn
  enable_waf          = true
  waf_web_acl_arn     = module.waf.web_acl_arn
  tags                = local.common_tags
}

# ============================================================
# Module: WAF (Web Application Firewall)
# ============================================================
module "waf" {
  source = "../../modules/waf"

  environment = local.environment
  enabled     = true
  rate_limit  = 2000 # requests per 5 minutes
  tags        = local.common_tags
}

# ============================================================
# Module: KMS (Encryption Keys)
# ============================================================
module "kms" {
  source = "../../modules/kms"

  environment = local.environment
  tags        = local.common_tags
}

# ============================================================
# Kubernetes Provider Configuration
# ============================================================
data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

# ============================================================
# Outputs
# ============================================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
}

output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "cloudfront_urls" {
  description = "CloudFront distribution URLs"
  value       = module.cdn.app_urls
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "deployment_summary" {
  description = "Deployment summary"
  value = {
    environment    = local.environment
    region         = var.aws_region
    vpc_id         = module.network.vpc_id
    eks_cluster    = module.eks.cluster_name
    rds_endpoint   = module.rds.db_endpoint
    alb_endpoint   = module.alb.alb_dns_name
  }
}
