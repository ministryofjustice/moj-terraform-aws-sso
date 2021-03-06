/*
  This rule checks if a user is:
  - signing in with GitHub
  - is part of an allowed organisation
  If so, it will start processing the next rule in the list or authorise a users access.
  Otherwise, it will reject the user.
*/
async function (user, context, callback) {
  const allowedOrganisations = JSON.parse(configuration.ALLOWED_ORGANISATIONS)

  if (context.connectionStrategy === 'github') {
    const identity = user.identities.find(identity => identity.provider === 'github')

    if (identity) {
      const { Octokit } = require('@octokit/rest@17.1.4')
      const octokit = new Octokit({ auth: identity.access_token })

      // Get the authenticated user's GitHub organisation memberships
      const userOrganisations = await octokit.request('GET /user/orgs').catch(error => callback(new Error(`Error retrieving orgs from GitHub: ${error}`)))

      // Check if a user is part of an allowed organisation
      const authorised = userOrganisations.data.map(organisation => organisation.login).some(organisation => allowedOrganisations.includes(organisation))

      // If user is part of the correct organisation, get teams they're a part of
      const allTeams = await octokit.request('GET /user/teams').catch(error => callback(new Error(`Error retrieving org teams from GitHub: ${error}`)))
      // Filter out non-authorised organisations
      const orgTeams = allTeams.data.filter(team => allowedOrganisations.includes(team.organization.login)).map(team => team.slug)

      if (authorised) {
        return callback(null, { ...user, teams: orgTeams }, context)
      }
    }
  }

  return callback(new UnauthorizedError('Access denied.'))
}
