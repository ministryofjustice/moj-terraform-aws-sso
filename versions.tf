terraform {
  required_version = ">= 0.15"
  required_providers {
    auth0 = {
      source  = "alexkappa/auth0"
      version = "0.23.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">=3.60.0"
    }
  }
}
