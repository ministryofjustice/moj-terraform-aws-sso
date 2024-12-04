/*
  This rule checks if a user is:
  - signing in with GitHub
  - is part of an allowed organisation
  If so, it will start processing the next rule in the list or authorise a users access.
  Otherwise, it will reject the user.
*/
const { Octokit } = require('@octokit/rest')
const { ManagementClient } = require('auth0')

async function getIdpAccessToken (clientId, clientSecret, tenantDomain, userId) {
  const management = new ManagementClient({
    domain: tenantDomain,
    clientId,
    clientSecret
  })

  const response = await management.users.get({ id: userId })
  return response.data.identities.find(function (identity) {
    return identity.provider.toLowerCase() === 'github'
  })
}

exports.onExecutePostLogin = async (event, api) => {
  const { AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET, AUTH0_TENANT_DOMAIN, ALLOWED_ORGANISATIONS } = event.secrets
  const allowedOrganisations = JSON.parse(ALLOWED_ORGANISATIONS)
  if (event.connection.strategy.toLowerCase() === 'azure-entraid') {
    return;
  }
  if (event.connection.strategy.toLowerCase() === 'github') {
    const identity = event.user.identities.find(identity => identity.provider.toLowerCase() === 'github')

    if (identity) {
      // Get user's GitHub access token from Auth0 Management API, to find organisations/teams for the user
      const githubIdentity = await getIdpAccessToken(AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET, AUTH0_TENANT_DOMAIN, event.user.user_id).catch(error => api.access.deny(`Error calling Auth0 Management API: ${error}`))

      const octokit = new Octokit({ auth: githubIdentity.access_token })

      // Get the authenticated user's GitHub organisation memberships
      const userOrganisations = await octokit.request('GET /user/orgs').catch(error => api.access.deny(`Error retrieving orgs from GitHub: ${error}`))

      // Check if a user is part of an allowed organisation
      const authorised = userOrganisations.data.map(organisation => organisation.login).some(organisation => allowedOrganisations.includes(organisation))

      if (authorised) {
        const allowedDomain = JSON.parse(event.secrets.ALLOWED_DOMAINS)

        // AWS requires the SAML nameID format to be an email address, which must
        // exactly match an existing user in AWS SSO:
        // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
        api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', `${event.user.nickname}${allowedDomain}`)
        api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', `${event.user.nickname}${allowedDomain}`)

        // Set SAML attribute for the user's GitHub team memberships
        // Ensure character limit stays inside documented constraint
        const userTeamsResponse = await octokit.request('GET /user/teams').catch(error => api.access.deny(`Error retrieving teams from GitHub: ${error}`))
        const userTeamSlugs     = userTeamsResponse.data.map(team => team.slug)
        const joinTeamSlugs     = userTeamSlugs.join(':')
        const trimTeamSlugs     = joinTeamSlugs.slice(0, 256)
        api.samlResponse.setAttribute('https://aws.amazon.com/SAML/Attributes/AccessControl:github_team', `${trimTeamSlugs}`)

        return // this empty return is required by auth0 to continue to the next action
      }
    }
  }

  return api.access.deny('Access denied.')
}
