/*
  This rule checks if a user is:
  - is part of an allowed organisation when signing in with GitHub
  If so, it will start processing the next rule in the list or authorise a users access.
  Otherwise, it will reject the user.

  For users signing in with the GitHub-via-Entra-ID connection (an Entra ID connection named
  by the GITHUB_VIA_ENTRA_CONNECTION_NAME secret), it authorises the GitHub account linked to
  the Entra ID identity through the organisation's SAML SSO, and maps that account's AWS
  identity and team memberships exactly as a GitHub sign-in does. The sign-in is denied if
  there is not exactly one linked account, or if GitHub cannot be reached.
*/
const { Octokit } = require('@octokit/rest')
const { createAppAuth } = require('@octokit/auth-app')
const { ManagementClient } = require('auth0')

const ENFORCE_TIMEOUT_MS = 8000
const EMAIL_INDEX_TTL_MS = 15 * 60 * 1000
const EMAIL_INDEX_MAX_PAGES = 50

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

const ALL_LINKED_IDENTITIES_QUERY = `
  query ($organisation: String!, $cursor: String) {
    organization(login: $organisation) {
      samlIdentityProvider {
        externalIdentities(membersOnly: true, first: 100, after: $cursor) {
          nodes { user { login } samlIdentity { emails { value } } }
          pageInfo { hasNextPage endCursor }
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

// Email -> linked GitHub logins, per organisation; kept between executions while the action instance is warm
const emailIndexes = new Map()

async function getEmailIndex(octokit, organisation) {
  const cached = emailIndexes.get(organisation)
  if (cached && Date.now() - cached.builtAt < EMAIL_INDEX_TTL_MS) {
    return cached.index
  }
  const index = new Map()
  let cursor = null
  let pages = 0
  do {
    if (++pages > EMAIL_INDEX_MAX_PAGES) {
      throw new Error(`more than ${EMAIL_INDEX_MAX_PAGES} pages of linked identities`)
    }
    const response = await octokit.graphql(ALL_LINKED_IDENTITIES_QUERY, { organisation, cursor })
    const identities = response.organization.samlIdentityProvider.externalIdentities
    for (const node of identities.nodes) {
      if (!node?.user?.login) {
        continue
      }
      for (const email of node.samlIdentity?.emails || []) {
        const key = email.value.toLowerCase()
        index.set(key, [...(index.get(key) || []), node.user.login])
      }
    }
    cursor = identities.pageInfo.hasNextPage ? identities.pageInfo.endCursor : null
  } while (cursor)
  emailIndexes.set(organisation, { builtAt: Date.now(), index })
  return index
}

// Fallback when the Entra ID user ID differs from the SAML NameID: match on the SAML identity's email
async function findLinkedGitHubAccountsByEmail(octokit, organisations, email) {
  const matches = []
  for (const organisation of organisations) {
    const index = await getEmailIndex(octokit, organisation)
    for (const login of new Set(index.get(email.toLowerCase()) || [])) {
      matches.push({ organisation, login })
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

async function resolveGitHubIdentity(event, organisations, { emailFallback = false } = {}) {
  const octokit = githubAppClient(event.secrets)
  let method = 'id'
  let matches = await findLinkedGitHubAccounts(octokit, organisations, event.user.user_id)
  if (matches.length === 0 && emailFallback && event.user.email) {
    method = 'email'
    matches = await findLinkedGitHubAccountsByEmail(octokit, organisations, event.user.email)
  }
  if (matches.length !== 1) {
    return { method, matches: matches.length }
  }
  const { organisation, login } = matches[0]
  const teams = await getTeamSlugs(octokit, organisation, login)
  return { method, matches: 1, login, teams }
}

function hasGitHubAppConfig(secrets) {
  return Boolean(secrets.GITHUB_APP_ID && secrets.GITHUB_APP_INSTALLATION_ID && secrets.GITHUB_APP_PRIVATE_KEY)
}

function setSamlAttributes(api, login, allowedDomain, teamSlugs) {
  // AWS requires the SAML nameID format to be an email address, which must
  // exactly match an existing user in AWS SSO:
  // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', `${login}${allowedDomain}`)
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', `${login}${allowedDomain}`)

  // Set SAML attribute for the user's GitHub team memberships
  // Ensure character limit stays inside documented constraint
  const trimTeamSlugs = teamSlugs.join(':').slice(0, 256)
  api.samlResponse.setAttribute('https://aws.amazon.com/SAML/Attributes/AccessControl:github_team', `${trimTeamSlugs}`)
}

async function onGitHubViaEntraIdLogin(event, api) {
  if (!hasGitHubAppConfig(event.secrets)) {
    return api.access.deny('GitHub App is not configured')
  }

  const organisations = JSON.parse(event.secrets.ALLOWED_ORGANISATIONS)
  const started = Date.now()

  let result
  try {
    result = await withTimeout(resolveGitHubIdentity(event, organisations, { emailFallback: true }), ENFORCE_TIMEOUT_MS)
  } catch (error) {
    console.log(`github-via-entraid result=error ms=${Date.now() - started} error=${error.message}`)
    return api.access.deny(`Error retrieving linked GitHub account: ${error.message}`)
  }
  console.log(`github-via-entraid result=ok method=${result.method} matches=${result.matches} teams=${result.teams ? result.teams.length : 0} ms=${Date.now() - started}`)

  if (result.matches === 0) {
    return api.access.deny('No GitHub account is linked to this identity through organisation SSO')
  }
  if (result.matches > 1) {
    return api.access.deny('More than one GitHub account is linked to this identity')
  }

  const allowedDomain = JSON.parse(event.secrets.ALLOWED_DOMAINS)
  setSamlAttributes(api, result.login, allowedDomain, result.teams)
}

exports.onExecutePostLogin = async (event, api) => {
  const { AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET, AUTH0_TENANT_DOMAIN, ALLOWED_ORGANISATIONS } = event.secrets
  const allowedOrganisations = JSON.parse(ALLOWED_ORGANISATIONS)
  const connectionName = event.connection.name.toLowerCase()
  const githubConnectionName = 'github'

  if (connectionName === event.secrets.GITHUB_VIA_ENTRA_CONNECTION_NAME?.toLowerCase()) {
    return onGitHubViaEntraIdLogin(event, api)
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
