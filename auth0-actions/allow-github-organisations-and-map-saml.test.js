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

describe('onExecutePostLogin with an Entra ID sign-in', () => {
  let mockEvent
  let mockApi
  let mockGraphql
  let logSpy

  const linkedIdentityResponse = (logins) => ({
    organization: { samlIdentityProvider: { externalIdentities: { nodes: logins.map(login => ({ user: { login } })) } } },
  })
  const teamsResponse = (slugs, hasNextPage = false, endCursor = null) => ({
    organization: { teams: { nodes: slugs.map(slug => ({ slug })), pageInfo: { hasNextPage, endCursor } } },
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
        ALLOWED_ORGANISATIONS: '["ministryofjustice"]',
        ALLOWED_DOMAINS: '["@example.com"]',
        ENTRA_CONNECTION_NAME: 'azure-entraid',
        ENTRA_GITHUB_MAPPING: 'shadow',
        GITHUB_APP_ID: '1',
        GITHUB_APP_INSTALLATION_ID: '2',
        GITHUB_APP_PRIVATE_KEY: 'key',
      },
      connection: { name: 'azure-entraid' },
      user: { user_id: 'waad|test-id', identities: [{ connection: 'azure-entraid' }], nickname: 'test.user' },
    }
    mockApi = {
      access: { deny: jest.fn() },
      samlResponse: { setAttribute: jest.fn() },
    }
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  const expectUnchanged = () => {
    expect(mockApi.access.deny).not.toHaveBeenCalled()
    expect(mockApi.samlResponse.setAttribute).not.toHaveBeenCalled()
  }

  test('mapping off: no GitHub lookups and sign-in unchanged', async () => {
    mockEvent.secrets.ENTRA_GITHUB_MAPPING = 'off'

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expectUnchanged()
  })

  test('mapping secret absent: treated as off', async () => {
    delete mockEvent.secrets.ENTRA_GITHUB_MAPPING

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expectUnchanged()
  })

  test('shadow without GitHub App configuration: logs and leaves sign-in unchanged', async () => {
    mockEvent.secrets.GITHUB_APP_PRIVATE_KEY = ''

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('entra-github-mapping mode=shadow result=not-configured')
    expectUnchanged()
  })

  test('shadow with a linked account: looks up the account and teams by user id, logs, leaves sign-in unchanged', async () => {
    mockGraphql
      .mockResolvedValueOnce(linkedIdentityResponse(['test-user']))
      .mockResolvedValueOnce(teamsResponse(['team-1'], true, 'cursor-1'))
      .mockResolvedValueOnce(teamsResponse(['team-2']))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockGraphql).toHaveBeenCalledTimes(3)
    expect(mockGraphql.mock.calls[0][1]).toEqual({ organisation: 'ministryofjustice', userName: 'waad|test-id' })
    expect(mockGraphql.mock.calls[1][1]).toEqual({ organisation: 'ministryofjustice', login: 'test-user', cursor: null })
    expect(mockGraphql.mock.calls[2][1]).toEqual({ organisation: 'ministryofjustice', login: 'test-user', cursor: 'cursor-1' })
    expect(logSpy.mock.calls[0][0]).toMatch(/^entra-github-mapping mode=shadow result=ok id_length=12 matches=1 teams=2 ms=\d+$/)
    expectUnchanged()
  })

  test('shadow with no linked account: logs zero matches, leaves sign-in unchanged', async () => {
    mockGraphql.mockResolvedValueOnce(linkedIdentityResponse([]))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockGraphql).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][0]).toMatch(/result=ok id_length=12 matches=0 teams=0/)
    expectUnchanged()
  })

  test('shadow with more than one linked account: logs, does not look up teams, leaves sign-in unchanged', async () => {
    mockGraphql.mockResolvedValueOnce(linkedIdentityResponse(['user-a', 'user-b']))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(mockGraphql).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][0]).toMatch(/result=ok id_length=12 matches=2 teams=0/)
    expectUnchanged()
  })

  test('shadow when GitHub errors: logs the error, leaves sign-in unchanged', async () => {
    mockGraphql.mockRejectedValueOnce(new Error('Resource not accessible by integration'))

    await onExecutePostLogin(mockEvent, mockApi)

    expect(logSpy.mock.calls[0][0]).toMatch(/result=error ms=\d+ error=Resource not accessible by integration$/)
    expectUnchanged()
  })

  test('shadow when GitHub is slow: gives up after the timeout, leaves sign-in unchanged', async () => {
    jest.useFakeTimers()
    mockGraphql.mockReturnValueOnce(new Promise(() => {}))

    const login = onExecutePostLogin(mockEvent, mockApi)
    await jest.advanceTimersByTimeAsync(1500)
    await login

    expect(logSpy.mock.calls[0][0]).toMatch(/result=error ms=\d+ error=timed out after 1500ms$/)
    expectUnchanged()
    jest.useRealTimers()
  })

  test('another connection: no GitHub lookups and sign-in unchanged', async () => {
    mockEvent.connection = { name: 'Username-Password-Authentication' }

    await onExecutePostLogin(mockEvent, mockApi)

    expect(MockOctokit).not.toHaveBeenCalled()
    expectUnchanged()
  })
})
