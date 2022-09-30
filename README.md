# moj-terraform-aws-sso

[![repo standards badge](https://img.shields.io/badge/dynamic/json?color=blue&style=for-the-badge&logo=github&label=MoJ%20Compliant&query=%24.result&url=https%3A%2F%2Foperations-engineering-reports.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fmoj-terraform-aws-sso)](https://operations-engineering-reports.cloud-platform.service.justice.gov.uk/public-github-repositories.html#moj-terraform-aws-sso "Link to report")


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
  auth0_github_allowed_orgs  = ["ministryofjustice"]
  auth0_allowed_domains      = "@digital.justice.gov.uk"
  auth0_aws_sso_acs_url      = "https://region.signin.aws.amazon.com/platform/saml/acs/${random-key}"
  auth0_aws_sso_issuer_url   = "https://region.signin.aws.amazon.com/platform/saml/${random-key}"
  sso_aws_region             = "eu-west-2"
  sso_scim_token             = "${random-string}"
  sso_tenant_id              = "${random-string}"
}
```

## Inputs
| Name                                  | Description                                                          | Type    | Default | Required |
|---------------------------------------|----------------------------------------------------------------------|---------|---------|----------|
| auth0_tenant_domain                   | Tenant domain from the Auth0 account to create applicable resources  | string  | n/a     | yes      |
| auth0_client_id                       | Auth0 application (Machine to Machine) client ID to utilise          | string  | n/a     | yes      |
| auth0_client_secret                   | Auth0 application (Machine to Machine) client secret to utilise      | string  | n/a     | yes      |
| auth0_debug                           | Whether to turn Auth0 debugging on or off                            | boolean | `false` | no       |
| auth0_github_client_id                | GitHub OAuth app client ID for an Auth0 social connection            | string  | n/a     | yes      |
| auth0_github_client_secret            | GitHub OAuth app client secret for an Auth0 social connection        | string  | n/a     | yes      |
| auth0_github_allowed_orgs             | A list of organisations a user has to be part of to authenticate     | list    | n/a     | yes      |
| auth0_allowed_domains                 | An authorised domain a user must have in their GitHub account        | string  | n/a     | yes      |
| auth0_aws_sso_acs_url                 | AWS SSO ACS URL, as provided by AWS when you set up AWS SSO          | string  | n/a     | yes      |
| auth0_aws_sso_issuer_url              | AWS SSO Issuer URL, as provided by AWS when you set up AWS SSO       | string  | n/a     | yes      |
| auth0_rule_enable_email_address_check | Whether to check someone has a verified email or not                 | boolean | `false` | no       |
| sso_aws_region                        | Region that AWS SSO is configured in (required for the SCIM URL)     | string  | n/a     | yes      |
| sso_scim_token                        | AWS SSO SCIM token                                                   | string  | n/a     | yes      |
| sso_tenant_id                         | AWS SSO tenant ID                                                    | string  | n/a     | yes      |
