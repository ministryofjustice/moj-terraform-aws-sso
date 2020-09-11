# modernisation-platform-terraform-iam-federated-access

This repository holds a Terraform module that creates an Auth0 application and associated integrations to enable IAM Federated Access in AWS.

## Usage
```
module "iam_federation" {
  source              = "github.com/ministryofjustice/modernisation-platform-terraform-iam-federated-access"
  auth0_tenant_domain        = ""
  auth0_client_id            = ""
  auth0_client_secret        = ""
  auth0_debug                = false
  auth0_github_client_id     = ""
  auth0_github_client_secret = ""
  auth0_github_allowed_orgs  = ["ministryofjustice"]

}
```

## Inputs
| Name                       | Description                                                         | Type    | Default | Required |
|----------------------------|---------------------------------------------------------------------|---------|---------|----------|
| auth0_tenant_domain        | Tenant domain from the Auth0 account to create applicable resources | string  | n/a     | yes      |
| auth0_client_id            | Auth0 application (Machine to Machine) client ID to utilise         | string  | n/a     | yes      |
| auth0_client_secret        | Auth0 application (Machine to Machine) client secret to utilise     | string  | n/a     | yes      |
| auth0_debug                | Whether to turn Auth0 debugging on or off                           | boolean | `false` | no       |
| auth0_github_client_id     | GitHub OAuth app client ID for an Auth0 social connection           | string  | n/a     | yes      |
| auth0_github_client_secret | GitHub OAuth app client secret for an Auth0 social connection       | string  | n/a     | yes      |
| auth0_github_allowed_orgs  | A list of organisations a user has to be part of to authenticate    | list    | n/a     | yes      |

## Outputs
| Name            | Description                            | Sensitive |
|-----------------|----------------------------------------|-----------|
| saml_login_page | URL for the SAML login page from Auth0 | no        |

## Looking for issues?
If you're looking to raise an issue with this module, please create a new issue in the [Modernisation Platform repository](https://github.com/ministryofjustice/modernisation-platform/issues).
