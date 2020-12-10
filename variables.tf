variable "auth0_tenant_domain" {
  description = "Auth0 tenant domain"
  type        = string
}

variable "auth0_client_id" {
  description = "Auth0 client ID (from a Machine to Machine application)"
  type        = string
}

variable "auth0_client_secret" {
  description = "Auth0 client secret (from a Machine to Machine application)"
  type        = string
}

variable "auth0_debug" {
  description = "Auth0 debug flag"
  type        = bool
  default     = false
}

variable "auth0_github_client_id" {
  description = "Auth0: GitHub client ID"
  type        = string
}

variable "auth0_github_client_secret" {
  description = "Auth0: GitHub client secret"
  type        = string
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
}

variable "auth0_aws_sso_issuer_url" {
  description = "AWS SSO: Issuer URL"
  type        = string
}

variable "auth0_rule_enable_email_address_check" {
  type        = bool
  description = "Whether to enable the email address check rule in Auth0"
  default     = false
}

variable "sso_aws_region" {
  type        = string
  description = "Region that AWS SSO is configured in (required for the SCIM URL)"
}
variable "sso_scim_token" {
  type        = string
  description = "AWS SSO SCIM token. Generated and shown only once when you turn on AWS SSO automatic SCIM provisioning"
}

variable "sso_tenant_id" {
  type        = string
  description = "AWS SSO tenant ID. Available from the Automatic provisioning section in AWS SSO"
}
