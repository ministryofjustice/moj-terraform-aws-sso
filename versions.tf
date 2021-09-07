terraform {
  required_version = ">= 0.14"
  required_providers {
    auth0 = {
      source = "alexkappa/auth0"
    }
    aws = {
      source = "hashicorp/aws"
    }
    external = {
      source = "hashicorp/external"
    }
  }
}
