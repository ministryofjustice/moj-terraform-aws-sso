/*
  This rule maps an authenticated user's information to the correct SAML attributes.
*/
function (user, context, callback) {
  // AWS requires the SAML nameID format to be an email address, which must
  // exactly match an existing user in AWS SSO:
  // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
  const anyAuthorisedEmail = user.emails.find(item => item)
  user.email = anyAuthorisedEmail
  user.name = anyAuthorisedEmail

  return callback(null, user, context)
}
