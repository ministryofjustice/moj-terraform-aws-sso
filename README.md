# moj-terraform-aws-sso

[![repo standards badge](https://github-community.service.justice.gov.uk/repository-standards/api/moj-terraform-aws-sso/badge)](https://github-community.service.justice.gov.uk/repository-standards/moj-terraform-aws-sso)

This Terraform module creates an Auth0 application and associated integrations to enable AWS SSO.

## Usage

```
module "sso" {
  source                     = "github.com/ministryofjustice/moj-terraform-aws-sso"
  auth0_tenant_domain        = ""
  auth0_client_id            = ""
  auth0_client_secret        = ""
  auth0_debug                = false
  auth0_github_client_id     = ""
  auth0_github_client_secret = ""
  auth0_github_allowed_orgs  = ["example"]
  auth0_allowed_domains      = "@example.com"
  auth0_aws_sso_acs_urls     = [
    "https://${region}.signin.aws.amazon.com/platform/saml/acs/${random_key}",
    "https://${region}.sso.signin.aws/platform/saml/acs/${random_key}",
  ]
  auth0_azure_entraid_client_id = ""
  auth0_azure_entraid_client_secret = ""
  auth0_azure_entraid_domain = "example.com"
}
```

Supply the ACS URLs shown in the IAM Identity Center console under **Settings >
Identity source > Actions > Manage authentication**. Include both the existing
alternative IPv4-only endpoint and the dual-stack endpoint to support sign-in
through either endpoint. See the [AWS ACS endpoint documentation](https://docs.aws.amazon.com/singlesignon/latest/userguide/multi-region-workforce-access.html).

The SAML addon deliberately omits `destination` and `recipient`: Auth0 defaults
both to the ACS URL in the incoming SAML request, or the application callback URL
when there is no SAML request. This avoids forcing responses to the old endpoint
when sign-in uses the dual-stack endpoint. See [Auth0's SAML assertion defaults](https://auth0.com/docs/authenticate/protocols/saml/saml-configuration/customize-saml-assertions).

The addon also omits `audience`, allowing Auth0 to use the Issuer from the incoming
SAMLRequest rather than forcing a single configured value. This is the default
documented in the [Auth0 provider's SAML addon schema](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/client#nested-schema-for-addonssamlp).

### Migrating from a single ACS URL

This is a breaking input change. Replace `auth0_aws_sso_acs_url = "..."` with
`auth0_aws_sso_acs_urls = ["...", "..."]`, retaining the existing URL and adding
the dual-stack URL from IAM Identity Center. The list is required, cannot be null,
and must contain at least one URL.

Also remove `auth0_aws_sso_issuer_url` from module calls. This input has been
removed because Auth0 now derives the audience from the incoming SAMLRequest.

<!-- BEGIN_TF_DOCS -->

## Requirements

| Name                                                                     | Version  |
| ------------------------------------------------------------------------ | -------- |
| <a name="requirement_terraform"></a> [terraform](#requirement_terraform) | >= 1.0.0 |
| <a name="requirement_auth0"></a> [auth0](#requirement_auth0)             | >= 1.0.0 |
| <a name="requirement_aws"></a> [aws](#requirement_aws)                   | >= 5.0.0 |

## Providers

| Name                                                   | Version  |
| ------------------------------------------------------ | -------- |
| <a name="provider_auth0"></a> [auth0](#provider_auth0) | >= 1.0.0 |
| <a name="provider_aws"></a> [aws](#provider_aws)       | >= 5.0.0 |

## Modules

No modules.

## Resources

| Name                                                                                                                              | Type        |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [auth0_action.allow_github_organisations](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/action)       | resource    |
| [auth0_action.saml_mappings](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/action)                    | resource    |
| [auth0_client.idp_token](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/client)                        | resource    |
| [auth0_client.saml](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/client)                             | resource    |
| [auth0_client_grant.idp_grant](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/client_grant)            | resource    |
| [auth0_connection.github_saml_connection](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/connection)   | resource    |
| [auth0_trigger_actions.flow](https://registry.terraform.io/providers/auth0/auth0/latest/docs/resources/trigger_actions)           | resource    |
| [auth0_client.idp_token](https://registry.terraform.io/providers/auth0/auth0/latest/docs/data-sources/client)                     | data source |
| [aws_iam_account_alias.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_account_alias) | data source |

## Inputs

| Name                                                                                                                           | Description                                                                           | Type           | Default | Required |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------- | ------- | :------: |
| <a name="input_auth0_allowed_domains"></a> [auth0_allowed_domains](#input_auth0_allowed_domains)                               | A list of authorised domains a user must have as part of their GitHub email addresses | `string`       | n/a     |   yes    |
| <a name="input_auth0_aws_sso_acs_urls"></a> [auth0_aws_sso_acs_urls](#input_auth0_aws_sso_acs_urls)                            | AWS IAM Identity Center allowed ACS URLs, including the alternative IPv4-only and dual-stack endpoints | `list(string)` | n/a | yes |
| <a name="input_auth0_client_id"></a> [auth0_client_id](#input_auth0_client_id)                                                 | Auth0 client ID (from a Machine to Machine application)                               | `string`       | n/a     |   yes    |
| <a name="input_auth0_client_secret"></a> [auth0_client_secret](#input_auth0_client_secret)                                     | Auth0 client secret (from a Machine to Machine application)                           | `string`       | n/a     |   yes    |
| <a name="input_auth0_debug"></a> [auth0_debug](#input_auth0_debug)                                                             | Auth0 debug flag                                                                      | `bool`         | `false` |    no    |
| <a name="input_auth0_github_allowed_orgs"></a> [auth0_github_allowed_orgs](#input_auth0_github_allowed_orgs)                   | A list of GitHub organisations a user has to be part of                               | `list(string)` | n/a     |   yes    |
| <a name="input_auth0_github_client_id"></a> [auth0_github_client_id](#input_auth0_github_client_id)                            | Auth0: GitHub client ID                                                               | `string`       | n/a     |   yes    |
| <a name="input_auth0_github_client_secret"></a> [auth0_github_client_secret](#input_auth0_github_client_secret)                | Auth0: GitHub client secret                                                           | `string`       | n/a     |   yes    |
| <a name="input_auth0_tenant_domain"></a> [auth0_tenant_domain](#input_auth0_tenant_domain)                                     | Auth0 tenant domain                                                                   | `string`       | n/a     |   yes    |
| <a name="auth0_azure_entraid_client_id"></a> [auth0_azure_entraid_client_id](#input_auth0_azure_entraid_client_id)             | Client id for the azures application                                                  | `string`       | n/a     |   yes    |
| <a name="auth0_azure_entraid_client_secret"></a> [auth0_azure_entraid_client_secret](#input_auth0_azure_entraid_client_secret) | Client secret for the azures application                                              | `string`       | n/a     |   yes    |
| <a name="auth0_azure_entraid_domain"></a> [auth0_azure_entraid_domain](#input_auth0_azure_entraid_domain)                      | Azures application domain name                                                        | `string`       | n/a     |   yes    |

## Outputs

No outputs.

<!-- END_TF_DOCS -->
