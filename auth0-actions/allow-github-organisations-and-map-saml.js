/*
  This rule checks if a user is:
  - is part of an allowed organisation when signing in with GitHub
  If so, it will start processing the next rule in the list or authorise a users access.
  Otherwise, it will reject the user.

  For users signing in with Entra ID, it can optionally look up the GitHub account linked
  to the Entra ID identity through the organisation's SAML SSO, controlled by the
  ENTRA_GITHUB_MAPPING secret:
  - off (default): Entra ID sign-ins are not changed
  - shadow: look up the linked GitHub account and teams and log the outcome; the sign-in
    is never denied and the SAML response is never changed
*/
const { Octokit } = require('@octokit/rest')
const { createAppAuth } = require('@octokit/auth-app')
const { ManagementClient } = require('auth0')

const SHADOW_TIMEOUT_MS = 1500

const LINKED_IDENTITY_QUERY = `
  query ($organisation: String!, $userName: String!) {
    organization(login: $organisation) {
      samlIdentityProvider {
        externalIdentities(userName: $userName, membersOnly: true, first: 2) {
          nodes { user { login } }
        }
      }
    }
  }`

const USER_TEAMS_QUERY = `
  query ($organisation: String!, $login: String!, $cursor: String) {
    organization(login: $organisation) {
      teams(userLogins: [$login], first: 100, after: $cursor) {
        nodes { slug }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`

async function getIdpAccessToken(clientId, clientSecret, tenantDomain, userId) {
  const management = new ManagementClient({
    domain: tenantDomain,
    clientId,
    clientSecret
  })

  const response = await management.users.get({ id: userId })
  return response.data.identities.find(function(identity) {
    return identity.provider.toLowerCase() === 'github'
  })
}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function githubAppClient(secrets) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: secrets.GITHUB_APP_ID,
      privateKey: secrets.GITHUB_APP_PRIVATE_KEY,
      installationId: secrets.GITHUB_APP_INSTALLATION_ID
    }
  })
}

// Find the GitHub accounts linked to this Entra ID identity through SAML SSO, across the allowed organisations
async function findLinkedGitHubAccounts(octokit, organisations, userName) {
  const matches = []
  for (const organisation of organisations) {
    const response = await octokit.graphql(LINKED_IDENTITY_QUERY, { organisation, userName })
    const nodes = response?.organization?.samlIdentityProvider?.externalIdentities?.nodes || []
    for (const node of nodes) {
      if (node?.user?.login) {
        matches.push({ organisation, login: node.user.login })
      }
    }
  }
  return matches
}

async function getTeamSlugs(octokit, organisation, login) {
  const slugs = []
  let cursor = null
  do {
    const response = await octokit.graphql(USER_TEAMS_QUERY, { organisation, login, cursor })
    const teams = response.organization.teams
    slugs.push(...teams.nodes.map(team => team.slug))
    cursor = teams.pageInfo.hasNextPage ? teams.pageInfo.endCursor : null
  } while (cursor)
  return slugs
}

async function resolveGitHubIdentity(event, organisations) {
  const octokit = githubAppClient(event.secrets)
  const matches = await findLinkedGitHubAccounts(octokit, organisations, event.user.user_id)
  if (matches.length !== 1) {
    return { matches: matches.length }
  }
  const { organisation, login } = matches[0]
  const teams = await getTeamSlugs(octokit, organisation, login)
  return { matches: 1, login, teams }
}

async function onEntraIdLogin(event, api) {
  const mode = (event.secrets.ENTRA_GITHUB_MAPPING || 'off').toLowerCase()
  if (mode !== 'shadow') {
    return
  }

  const { GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY } = event.secrets
  if (!GITHUB_APP_ID || !GITHUB_APP_INSTALLATION_ID || !GITHUB_APP_PRIVATE_KEY) {
    console.log(`entra-github-mapping mode=${mode} result=not-configured`)
    return
  }

  const organisations = JSON.parse(event.secrets.ALLOWED_ORGANISATIONS)
  const started = Date.now()

  // Observe only: never deny and never change the SAML response
  try {
    const result = await withTimeout(resolveGitHubIdentity(event, organisations), SHADOW_TIMEOUT_MS)
    console.log(`entra-github-mapping mode=shadow result=ok id_length=${event.user.user_id.length} matches=${result.matches} teams=${result.teams ? result.teams.length : 0} ms=${Date.now() - started}`)
  } catch (error) {
    console.log(`entra-github-mapping mode=shadow result=error ms=${Date.now() - started} error=${error.message}`)
  }
}

exports.onExecutePostLogin = async (event, api) => {
  const { AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET, AUTH0_TENANT_DOMAIN, ALLOWED_ORGANISATIONS } = event.secrets
  const allowedOrganisations = JSON.parse(ALLOWED_ORGANISATIONS)
  const connectionName = event.connection.name.toLowerCase()
  const githubConnectionName = 'github'

  if (connectionName === event.secrets.ENTRA_CONNECTION_NAME?.toLowerCase()) {
    return onEntraIdLogin(event, api)
  }

  if (connectionName !== githubConnectionName) {
    return  // This action only applies when the user authenticates with the GitHub connection
  }

  const identity = event.user.identities.find(identity => identity.connection.toLowerCase() === githubConnectionName)
  if (!identity) {
    return api.access.deny('User does not have a GitHub identity')
  }

  // Get user's GitHub access token from Auth0 Management API, to find organisations/teams for the user
  const githubIdentity = await getIdpAccessToken(AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET, AUTH0_TENANT_DOMAIN, event.user.user_id).catch(error => api.access.deny(`Error calling Auth0 Management API: ${error}`))

  const octokit = new Octokit({ auth: githubIdentity.access_token })

  // Get the authenticated user's GitHub organisation memberships
  const userOrganisations = await octokit.request('GET /user/orgs').catch(error => api.access.deny(`Error retrieving orgs from GitHub: ${error}`))

  // Check if a user is part of an allowed organisation
  const authorised = userOrganisations?.data?.map(organisation => organisation.login).some(organisation => allowedOrganisations.includes(organisation))
  if (!authorised) {
    return api.access.deny('User is not part of an allowed organisation')
  }

  const allowedDomain = JSON.parse(event.secrets.ALLOWED_DOMAINS)

  // AWS requires the SAML nameID format to be an email address, which must
  // exactly match an existing user in AWS SSO:
  // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', `${event.user.nickname}${allowedDomain}`)
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', `${event.user.nickname}${allowedDomain}`)

  // Set SAML attribute for the user's GitHub team memberships
  // Ensure character limit stays inside documented constraint
  const userTeamsResponse = await octokit.request('GET /user/teams').catch(error => api.access.deny(`Error retrieving teams from GitHub: ${error}`))
  const userTeamSlugs = userTeamsResponse.data.map(team => team.slug)
  const joinTeamSlugs = userTeamSlugs.join(':')
  const trimTeamSlugs = joinTeamSlugs.slice(0, 256)
  api.samlResponse.setAttribute('https://aws.amazon.com/SAML/Attributes/AccessControl:github_team', `${trimTeamSlugs}`)

  return // this empty return is required by auth0 to continue to the next action
}
