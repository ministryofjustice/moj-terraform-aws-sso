terraform {
  required_version = ">= 0.13"
  required_providers {
    auth0 = {
      source = "alexkappa/auth0"
    }
    aws = {
      source = "hashicorp/aws"
    }
  }
}
