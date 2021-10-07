provider "auth0" {
  domain        = var.auth0_tenant_domain
  client_id     = var.auth0_client_id
  client_secret = var.auth0_client_secret
  debug         = var.auth0_debug
}
