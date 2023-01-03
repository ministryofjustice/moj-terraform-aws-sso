data "aws_iam_account_alias" "current" {}

# Auth0: Client setup
resource "auth0_client" "saml" {
  name               = "AWS SSO: ${data.aws_iam_account_alias.current.account_alias}"
  description        = "SAML provider for the ${data.aws_iam_account_alias.current.account_alias} account"
  callbacks          = [var.auth0_aws_sso_acs_url]
  logo_uri           = "https://ministryofjustice.github.io/assets/moj-crest.png"
  app_type           = "regular_web"
  initiate_login_uri = "https://moj.awsapps.com/start"
  is_first_party     = true

  addons {
    samlp {
      audience    = var.auth0_aws_sso_issuer_url
      destination = var.auth0_aws_sso_acs_url
      recipient   = var.auth0_aws_sso_acs_url

      mappings = {
        email = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        name  = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      }

      create_upn_claim                   = false
      passthrough_claims_with_no_mapping = false
      map_unknown_claims_as_is           = false
      map_identities                     = false
      name_identifier_format             = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
      name_identifier_probes = [
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      ]
      signature_algorithm           = "rsa-sha1"
      digest_algorithm              = "sha1"
      lifetime_in_seconds           = 3600
      sign_response                 = false
      typed_attributes              = true
      include_attribute_name_format = true
    }
  }
}

# # Auth0: Connection setup
resource "auth0_connection" "github_saml_connection" {
  name            = "GitHub"
  strategy        = "github"
  enabled_clients = [auth0_client.saml.id]
  options {
    client_id     = var.auth0_github_client_id
    client_secret = var.auth0_github_client_secret
    # These are the minimum scopes you need for a GitHub SAML connection and AWS SSO.
    scopes = ["read_user", "read_org", "email", "profile"]
  }
}

# Auth0 Rules: Set the configuration variables,
# which are accessible in Auth0 rules
resource "auth0_rule_config" "github_allowed_organisations" {
  key   = "ALLOWED_ORGANISATIONS"
  value = jsonencode(var.auth0_github_allowed_orgs)
}

resource "auth0_rule_config" "github_allowed_domains" {
  key   = "ALLOWED_DOMAINS"
  value = jsonencode(var.auth0_allowed_domains)
}

resource "auth0_rule_config" "sso_aws_region" {
  key   = "SSO_REGION"
  value = jsonencode(var.sso_aws_region)
}

resource "auth0_rule_config" "sso_scim_token" {
  key   = "SSO_SCIM_TOKEN"
  value = jsonencode(var.sso_scim_token)
}

resource "auth0_rule_config" "sso_tenant_id" {
  key   = "SSO_TENANT_ID"
  value = jsonencode(var.sso_tenant_id)
}

# Auth0 Rules: Attach rules from this repository
resource "auth0_rule" "allow_github_organisations" {
  name    = "Allow specific GitHub Organisations"
  script  = file("${path.module}/auth0-rules/allow-github-organisations.js")
  enabled = true
  order   = 10
}

resource "auth0_rule" "allow_email_addresses" {
  name    = "Allow specific email addresses attached to a GitHub user"
  script  = file("${path.module}/auth0-rules/allow-email-addresses.js")
  enabled = var.auth0_rule_enable_email_address_check
  order   = 20
}

resource "auth0_rule" "saml_mappings" {
  name    = "Map user data to the correct SAML attributes"
  script  = file("${path.module}/auth0-rules/saml-mappings.js")
  enabled = true
  order   = 30
}
