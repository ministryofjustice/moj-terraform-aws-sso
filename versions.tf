terraform {
  required_version = ">= 0.15"
  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "0.32.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">=3.60.0"
    }
  }
}
