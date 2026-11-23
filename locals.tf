locals {
  # The post-login action needs the GitHub App for the GitHub-via-Entra-ID connection
  github_app_required = var.github_via_entraid != "off"
}
