# moj-terraform-aws-sso

[![repo standards badge](https://github-community.cloud-platform.service.justice.gov.uk/repository-standards/api/moj-terraform-aws-sso/badge)](https://github-community.cloud-platform.service.justice.gov.uk/repository-standards/moj-terraform-aws-sso)

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
  auth0_aws_sso_acs_url      = "https://${region}.signin.aws.amazon.com/platform/saml/acs/${random_key}"
  auth0_aws_sso_issuer_url   = "https://${region}.signin.aws.amazon.com/platform/saml/${random_key}"
  auth0_azure_entraid_client_id = ""
  auth0_azure_entraid_client_secret = ""
  auth0_azure_entraid_domain = "example.com"
}
```

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
| <a name="input_auth0_aws_sso_acs_url"></a> [auth0_aws_sso_acs_url](#input_auth0_aws_sso_acs_url)                               | AWS SSO: ACS URL                                                                      | `string`       | n/a     |   yes    |
| <a name="input_auth0_aws_sso_issuer_url"></a> [auth0_aws_sso_issuer_url](#input_auth0_aws_sso_issuer_url)                      | AWS SSO: Issuer URL                                                                   | `string`       | n/a     |   yes    |
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
