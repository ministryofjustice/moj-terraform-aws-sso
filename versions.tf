terraform {
  required_version = ">= 0.13"
  required_providers {
    auth0 = {
      source = "terraform-providers/auth0"
    }
    aws = {
      source = "hashicorp/aws"
    }
    external = {
      source = "hashicorp/external"
    }
  }
}
