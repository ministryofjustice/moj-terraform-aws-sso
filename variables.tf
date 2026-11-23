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

variable "auth0_aws_sso_acs_urls" {
  description = "AWS IAM Identity Center allowed ACS URLs, including the alternative IPv4-only and dual-stack endpoints"
  type        = list(string)
  sensitive   = true

  validation {
    condition     = var.auth0_aws_sso_acs_urls == null ? false : length(var.auth0_aws_sso_acs_urls) > 0
    error_message = "At least one AWS IAM Identity Center ACS URL must be supplied."
  }
}

variable "auth0_azure_entraid_client_id" {
  description = "Client id for the azures application"
  type        = string
  sensitive   = true
}

variable "auth0_azure_entraid_client_secret" {
  description = "Client secret for the azures application"
  type        = string
  sensitive   = true
}

variable "auth0_azure_entraid_domain" {
  description = "Azures application domain name"
  type        = string
  sensitive   = true

}

variable "entra_github_mapping" {
  description = "Look up the GitHub account linked through the organisation's SAML SSO on Entra ID sign-ins: off, or shadow (look up and log only; sign-ins are not changed)"
  type        = string
  default     = "off"

  validation {
    condition     = contains(["off", "shadow"], var.entra_github_mapping)
    error_message = "entra_github_mapping must be one of: off, shadow."
  }
}

variable "github_app_id" {
  description = "GitHub App ID used to look up linked GitHub accounts and team memberships (required unless entra_github_mapping is off)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_app_installation_id" {
  description = "GitHub App installation ID for the organisation (required unless entra_github_mapping is off)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_app_private_key" {
  description = "GitHub App private key in PEM format (required unless entra_github_mapping is off)"
  type        = string
  default     = ""
  sensitive   = true
}
