# Jeju Network - Testnet Terraform Variables
# Override defaults for testnet-specific configuration

aws_region = "us-east-1"

availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

domain_name = "jeju.network"

# ACM Certificate ARN (MUST be in us-east-1 for CloudFront)
# Create manually first:
# 1. Request certificate in AWS Certificate Manager (us-east-1)
# 2. Add DNS validation records to Route53
# 3. Copy ARN here
acm_certificate_arn = "" # TODO: Set after creating ACM certificate

