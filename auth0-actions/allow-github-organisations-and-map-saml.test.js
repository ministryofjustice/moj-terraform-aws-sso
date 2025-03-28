jest.mock('auth0')
jest.mock('@octokit/rest')
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
