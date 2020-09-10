variable "auth0_tenant_domain" {
  description = "Auth0 tenant domain"
  type        = string
}

variable "auth0_client_id" {
  description = "Auth0 Client ID"
  type        = string
}

variable "auth0_client_secret" {
  description = "Auth0 Client Secret"
  type        = string
}

variable "auth0_debug" {
  description = "Auth0 Debug Flag"
  type        = bool
  default     = false
}
