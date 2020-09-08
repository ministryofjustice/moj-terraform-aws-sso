data "external" "metadata" {
  program = [
    "bash",
    "-c",
    "jq -sR '{ content : . }' <<<$(curl -s https://${var.auth0_tenant_domain}/samlp/metadata/${auth0_client.saml.client_id})",
  ]
}

resource "aws_iam_saml_provider" "auth0" {
  name                   = "auth0"
  saml_metadata_document = data.external.metadata.result["content"]
}

data "aws_iam_policy_document" "federated_role_trust_policy" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_saml_provider.auth0.arn]
    }

    actions = ["sts:AssumeRoleWithSAML"]

    condition {
      test     = "StringEquals"
      variable = "SAML:aud"
      values   = ["https://signin.aws.amazon.com/saml"]
    }
  }
}

resource "aws_iam_role" "federated_role" {
  name                 = "auth0"
  assume_role_policy   = data.aws_iam_policy_document.federated_role_trust_policy.json
  max_session_duration = 12 * 3600
}

resource "aws_iam_role_policy_attachment" "federatedAdminAttachment" {
  role       = aws_iam_role.federated_role.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
