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

# Auth0: Connection configuration
resource "auth0_connection" "github_saml_connection" {
  name     = "GitHub"
  strategy = "github"
  options {
    client_id     = var.auth0_github_client_id
    client_secret = var.auth0_github_client_secret
    # These are the minimum scopes you need for a GitHub SAML connection and AWS SSO.
    scopes = ["read_user", "read_org", "email", "profile"]
  }
}

# Auth0 Rules: Attach rules from this repository
resource "auth0_rule" "allow_github_organisations" {
  name    = "Allow specific GitHub Organisations"
  script  = file("${path.module}/auth0-rules/allow-github-organisations.js")
  enabled = true
  order   = 10
}

# Auth0 actions
resource "auth0_action" "saml_mappings" {
  name    = "Map user data to the correct SAML attributes"
  runtime = "node18" # currently doesn't support node20
  deploy  = true
  code    = file("${path.module}/auth0-actions/saml-mappings.js")

  supported_triggers {
    id      = "post-login"
    version = "v3"
  }

  secrets {
    name  = "ALLOWED_DOMAINS"
    value = jsonencode(var.auth0_allowed_domains)
  }
}

resource "auth0_trigger_actions" "flow" {
  trigger = "post-login"

  actions {
    id           = auth0_action.saml_mappings.id
    display_name = auth0_action.saml_mappings.name
  }
}
