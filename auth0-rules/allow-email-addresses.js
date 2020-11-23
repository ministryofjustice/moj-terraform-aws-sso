/*
  This rule checks if a user is:
  - signing in with GitHub
  - has an email address on an authorized domain
  If so, it will start processing the next rule in the list or authorise a users access.
  Otherwise, it will reject the user.
*/
async function (user, context, callback) {
  const allowedDomain = JSON.parse(configuration.ALLOWED_DOMAINS)

  if (context.connectionStrategy === 'github') {
    const identity = user.identities.find(identity => identity.provider === 'github')

    if (identity) {
      const { Octokit } = require('@octokit/rest@17.1.4')
      const octokit = new Octokit({ auth: identity.access_token })

      // Get the authenticated user's GitHub email addresses
      const userEmails = await octokit.request('GET /user/emails').catch(error => callback(new Error(`Error retrieving email addresses from GitHub: ${error}`)))

      // Check if any of the user's email addresses end with an authorized domain
      const authorisedEmails = userEmails.data.map(email => email.email).filter(email => email.endsWith(allowedDomain))

      if (authorisedEmails.length) {
        return callback(null, { ...user, emails: authorisedEmails }, context)
      }
    }
  }

  return callback(new UnauthorizedError('Access denied.'))
}
