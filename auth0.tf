data "aws_iam_account_alias" "current" {}
data "aws_caller_identity" "current" {}

# Auth0: Client setup
resource "auth0_client" "saml" {
  name        = "AWS-SAML: ${data.aws_iam_account_alias.current.account_alias}"
  description = "SAML provider for the ${data.aws_iam_account_alias.current.account_alias} account"
  callbacks   = ["https://signin.aws.amazon.com/saml"]
  logo_uri    = "https://ministryofjustice.github.io/assets/moj-crest.png"

  addons {
    samlp {
      audience = "https://signin.aws.amazon.com/saml"

      mappings = {
        email = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        name  = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
      }

      create_upn_claim                   = false
      passthrough_claims_with_no_mapping = false
      map_unknown_claims_as_is           = false
      map_identities                     = false
      name_identifier_format             = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"

      name_identifier_probes = [
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      ]

    }
  }
}

# Auth0 Rules: Set the configuration variables,
# which are accessible in Auth0 rules
resource "auth0_rule_config" "aws_account_id" {
  key   = "AWS_ACCOUNT_ID"
  value = data.aws_caller_identity.current.account_id
}

resource "auth0_rule_config" "aws_saml_provider_name" {
  key   = "AWS_SAML_PROVIDER_NAME"
  value = aws_iam_saml_provider.auth0.name
}

resource "auth0_rule_config" "aws_role_name" {
  key   = "AWS_ROLE_NAME"
  value = aws_iam_role.federated_role.name
}

# Auth0 Rules: Attach JavaScript files from this repository
resource "auth0_rule" "sample" {
  name    = "sample"
  script  = file("${path.module}/auth0-rules/sample-assume-role.js")
  enabled = true
}
