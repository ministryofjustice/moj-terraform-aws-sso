jest.mock('auth0')
jest.mock('@octokit/rest')
jest.mock('@octokit/auth-app')
const { ManagementClient: MockManagementClient } = require('auth0')
const { Octokit: MockOctokit } = require('@octokit/rest')

const { onExecutePostLogin, getIdpAccessToken } = require('./allow-github-organisations-and-map-saml')

const mockManagementClientImplementation = () => {
  MockManagementClient.mockImplementation(() => {
    return {
      users: {
        get: jest.fn().mockReturnValueOnce(Promise.resolve({ data: { identities: [{ provider: 'github', access_token: 'test-token' }] } })),
      },
    }
  })
}

const mockOctokitImplementation = (githubOrganisationLoginResponse = 'ministryofjustice') => {
  MockOctokit.mockImplementation(() => {
    return {
      request: jest
        .fn()
        .mockReturnValueOnce(Promise.resolve({ data: [{ login: githubOrganisationLoginResponse }] })) // Call to GET /user/orgs
        .mockReturnValueOnce(Promise.resolve({ data: [{ slug: 'test-team-1' }, { slug: 'test-team-2' }] })), // Call to GET /user/teams
    }
  })
}

describe('onExecutePostLogin', () => {
  let mockEvent
  let mockApi

  beforeEach(() => {
    mockManagementClientImplementation()
    mockOctokitImplementation()
    mockEvent = {
      secrets: {
        AUTH0_MANAGEMENT_CLIENT_ID: '',
        AUTH0_MANAGEMENT_CLIENT_SECRET: '',
        AUTH0_TENANT_DOMAIN: '',
        ALLOWED_ORGANISATIONS: '["ministryofjustice"]',
        ALLOWED_DOMAINS: '["@example.com"]',
      },
      connection: { name: 'github' },
      user: { identities: [{ connection: 'github' }], nickname: 'test-user' },
    }
    mockApi = {
      access: {
        deny: jest.fn(),
      },
      samlResponse: {
        setAttribute: jest.fn(),
      },
    }
  })

  test('successful login', async () => {
    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).not.toHaveBeenCalled()
    expect(mockApi.samlResponse.setAttribute.mock.calls).toEqual([
      ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'test-user@example.com'],
      ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', 'test-user@example.com'],
      ['https://aws.amazon.com/SAML/Attributes/AccessControl:github_team', 'test-team-1:test-team-2'],
    ])
  })

  test('access denied given user authenticates to GitHub Organisation not in allow list', async () => {
    mockOctokitImplementation((githubOrganisationLoginResponse = 'NOT_MOJ'))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).toHaveBeenCalledWith('User is not part of an allowed organisation')
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })

  test('access denied given user does not have a GitHub identity', async () => {
    mockEvent = {
      ...mockEvent,
      user: { identities: [{ connection: 'NOT_GITHUB' }], nickname: 'test-user' },
    }

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).toHaveBeenCalledWith('User does not have a GitHub identity')
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })
})

describe('onExecutePostLogin with a GitHub-via-Entra-ID sign-in', () => {
  let mockEvent
  let mockApi
  let mockGraphql
  let logSpy

  const linkedIdentityResponse = (logins) => ({
    organization: { samlIdentityProvider: { externalIdentities: { nodes: logins.map(login => ({ user: { login } })) } } },
  })
  const allIdentitiesResponse = (identities, hasNextPage = false, endCursor = null) => ({
    organization: {
      samlIdentityProvider: {
        externalIdentities: {
          nodes: identities.map(([login, email]) => ({ user: { login }, samlIdentity: { emails: [{ value: email }] } })),
          pageInfo: { hasNextPage, endCursor },
        },
      },
    },
  })
  const teamsResponse = (slugs) => ({
    organization: { teams: { nodes: slugs.map(slug => ({ slug })), pageInfo: { hasNextPage: false, endCursor: null } } },
  })

  beforeEach(() => {
    mockGraphql = jest.fn()
    MockOctokit.mockReset()
    MockOctokit.mockImplementation(() => ({ graphql: mockGraphql }))
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    mockEvent = {
      secrets: {
        AUTH0_MANAGEMENT_CLIENT_ID: '',
        AUTH0_MANAGEMENT_CLIENT_SECRET: '',
        AUTH0_TENANT_DOMAIN: '',
        // The email index is module state: a distinct organisation per test keeps tests independent
        ALLOWED_ORGANISATIONS: JSON.stringify([`org-${Math.random()}`]),
        ALLOWED_DOMAINS: '["@example.com"]',
        GITHUB_VIA_ENTRA_CONNECTION_NAME: 'github-via-entraid',
        GITHUB_APP_ID: '1',
        GITHUB_APP_INSTALLATION_ID: '2',
        GITHUB_APP_PRIVATE_KEY: 'key',
      },
      connection: { name: 'github-via-entraid' },
      user: { user_id: 'waad|test-id', email: 'Test.User@justice.example', identities: [{ connection: 'github-via-entraid' }], nickname: 'test.user' },
    }
    mockApi = {
      access: { deny: jest.fn() },
      samlResponse: { setAttribute: jest.fn() },
    }
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  const expectGitHubAttributes = (login, teams) => {
    expect(mockApi.access.deny).not.toHaveBeenCalled()
    expect(mockApi.samlResponse.setAttribute.mock.calls).toEqual([
      ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', `${login}@example.com`],
      ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', `${login}@example.com`],
      ['https://aws.amazon.com/SAML/Attributes/AccessControl:github_team', teams],
    ])
  }

  test('linked by user id: maps the GitHub identity and teams', async () => {
    mockGraphql
      .mockResolvedValueOnce(linkedIdentityResponse(['test-user']))
      .mockResolvedValueOnce(teamsResponse(['team-1', 'team-2']))

    await onExecutePostLogin(mockEvent, mockApi)

    expectGitHubAttributes('test-user', 'team-1:team-2')
    expect(logSpy.mock.calls[0][0]).toMatch(/^github-via-entraid result=ok method=id matches=1 teams=2 ms=\d+$/)
  })

  test('not linked by user id: falls back to the SAML identity email, case-insensitively', async () => {
    mockGraphql
      .mockResolvedValueOnce(linkedIdentityResponse([]))
      .mockResolvedValueOnce(allIdentitiesResponse([['someone-else', 'someone@justice.example']], true, 'cursor-1'))
      .mockResolvedValueOnce(allIdentitiesResponse([['test-user', 'test.user@justice.example']]))
      .mockResolvedValueOnce(teamsResponse(['team-1']))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockGraphql.mock.calls[2][1].cursor).toBe('cursor-1')
    expectGitHubAttributes('test-user', 'team-1')
    expect(logSpy.mock.calls[0][0]).toMatch(/method=email matches=1 teams=1/)
  })

  test('email index is reused while the action instance is warm', async () => {
    mockGraphql
      .mockResolvedValueOnce(linkedIdentityResponse([]))
      .mockResolvedValueOnce(allIdentitiesResponse([['test-user', 'test.user@justice.example']]))
      .mockResolvedValueOnce(teamsResponse(['team-1']))
      .mockResolvedValueOnce(linkedIdentityResponse([]))
      .mockResolvedValueOnce(teamsResponse(['team-1']))

    await onExecutePostLogin(mockEvent, mockApi)
    mockApi.samlResponse.setAttribute.mockClear()
    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockGraphql).toHaveBeenCalledTimes(5)
    expectGitHubAttributes('test-user', 'team-1')
  })

  test('no linked account: denied', async () => {
    mockGraphql
      .mockResolvedValueOnce(linkedIdentityResponse([]))
      .mockResolvedValueOnce(allIdentitiesResponse([]))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).toHaveBeenCalledWith('No GitHub account is linked to this identity through organisation SSO')
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })

  test('more than one linked account: denied', async () => {
    mockGraphql.mockResolvedValueOnce(linkedIdentityResponse(['user-a', 'user-b']))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).toHaveBeenCalledWith('More than one GitHub account is linked to this identity')
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })

  test('GitHub error: denied', async () => {
    mockGraphql.mockRejectedValueOnce(new Error('Resource not accessible by integration'))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockApi.access.deny).toHaveBeenCalledWith('Error retrieving linked GitHub account: Resource not accessible by integration')
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })

  test('GitHub App not configured: denied without GitHub calls', async () => {
    mockEvent.secrets.GITHUB_APP_ID = ''

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expect(mockApi.access.deny).toHaveBeenCalledWith('GitHub App is not configured')
  })

  test('Entra ID sign-in is unaffected: no GitHub calls and no changes', async () => {
    mockEvent.connection = { name: 'azure-entraid' }

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expect(mockApi.access.deny).not.toHaveBeenCalled()
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  })

  test('GitHub sign-in is unaffected when the GitHub-via-Entra-ID connection is configured', async () => {
    mockManagementClientImplementation()
    mockOctokitImplementation()
    mockEvent.secrets.ALLOWED_ORGANISATIONS = '["ministryofjustice"]'
    mockEvent.connection = { name: 'github' }
    mockEvent.user = { identities: [{ connection: 'github' }], nickname: 'test-user' }

    await onExecutePostLogin(mockEvent, mockApi)

    expectGitHubAttributes('test-user', 'test-team-1:test-team-2')
  })
})

