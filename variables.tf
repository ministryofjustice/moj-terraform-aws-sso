variable "auth0_tenant_domain" {
  description = "Auth0 tenant domain"
  type        = string
}

variable "auth0_client_id" {
  description = "Auth0 client ID (from a Machine to Machine application)"
  type        = string
  sensitive   = true
}

variable "auth0_client_secret" {
  description = "Auth0 client secret (from a Machine to Machine application)"
  type        = string
  sensitive   = true
}

variable "auth0_debug" {
  description = "Auth0 debug flag"
  type        = bool
  default     = false
}

variable "auth0_github_client_id" {
  description = "Auth0: GitHub client ID"
  type        = string
  sensitive   = true
}

variable "auth0_github_client_secret" {
  description = "Auth0: GitHub client secret"
  type        = string
  sensitive   = true
}

variable "auth0_github_allowed_orgs" {
  description = "A list of GitHub organisations a user has to be part of"
  type        = list(string)
}

variable "auth0_allowed_domains" {
  description = "A list of authorised domains a user must have as part of their GitHub email addresses"
  type        = string
}

variable "auth0_aws_sso_acs_url" {
  description = "AWS SSO: ACS URL"
  type        = string
  sensitive   = true
}

variable "auth0_aws_sso_issuer_url" {
  description = "AWS SSO: Issuer URL"
  type        = string
  sensitive   = true
}
