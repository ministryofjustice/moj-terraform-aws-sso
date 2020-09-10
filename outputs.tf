output "saml_login_page" {
  value = "https://${var.auth0_tenant_domain}/samlp/${auth0_client.saml.client_id}"
}
