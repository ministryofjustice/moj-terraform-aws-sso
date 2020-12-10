/*
  This rule maps an authenticated user's information to the correct SAML attributes.
*/
function (user, context, callback) {
  const allowedDomain = JSON.parse(configuration.ALLOWED_DOMAINS)

  // AWS requires the SAML nameID format to be an email address, which must
  // exactly match an existing user in AWS SSO:
  // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
  user.email = user.nickname + allowedDomain
  user.name = user.nickname + allowedDomain

  return callback(null, user, context)
}
