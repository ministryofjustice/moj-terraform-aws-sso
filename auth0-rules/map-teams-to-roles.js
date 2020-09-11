/*
  This rule checks if a user is:
  - signing in with GitHub
  - has a team membership within an allowed organisation
  - automatically maps team memberships to an AWS role
*/
async function (user, context, callback) {
  const allowedOrganisations = JSON.parse(configuration.ALLOWED_ORGANISATIONS)

  if (context.connectionStrategy === 'github') {
    const identity = user.identities.find(identity => identity.provider === 'github')

    if (identity) {
      const { Octokit } = require('@octokit/rest@17.1.4')
      const octokit = new Octokit({ auth: identity.access_token })

      // Get the authenticate user's GitHub teams membership
      const userOrganisationTeams = await octokit.request('GET /user/teams').catch(error => callback(new Error(`Error retrieving user teams from GitHub: ${error}`)))

      // Set AWS IdP arn and role arn
      const idpArn = `arn:aws:iam::${configuration.AWS_ACCOUNT_ID}:saml-provider/${configuration.AWS_SAML_PROVIDER_NAME}`
      const roleArnBase = `arn:aws:iam::${configuration.AWS_ACCOUNT_ID}:role/`

      // Map teams from allowed organisations into AWS roles
      user.awsRole = userOrganisationTeams.data.filter(team => allowedOrganisations.includes(team.organization.login)).map(team => `${roleArnBase + team.slug},${idpArn}`)

      // Set a users role session name (this uses a GitHub username, e.g. auth0/jakemulley)
      user.awsRoleSession = user.nickname

      // Configure SAML mappings
      context.samlConfiguration.mappings = {
        'https://aws.amazon.com/SAML/Attributes/Role': 'awsRole',
        'https://aws.amazon.com/SAML/Attributes/RoleSessionName': 'awsRoleSession'
      }

      // If the authenticated user isn't part of any teams in an allowed organisation, we won't grant them access.
      if(user.awsRole.length) {
        return callback(null, user, context)
      }

      return callback(new UnauthorizedError('Access denied: no team membership.'))
    }
  }
}
