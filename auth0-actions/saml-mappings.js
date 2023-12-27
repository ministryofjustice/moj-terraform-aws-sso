/*
  This rule maps an authenticated user's information to the correct SAML attributes.
*/
exports.onExecutePostLogin = async (event, api) => {
  const allowedDomain = JSON.parse(event.secrets.ALLOWED_DOMAINS)

  // AWS requires the SAML nameID format to be an email address, which must
  // exactly match an existing user in AWS SSO:
  // https://docs.aws.amazon.com/singlesignon/latest/userguide/troubleshooting.html
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', `${event.user.nickname}${allowedDomain}`)
  api.samlResponse.setAttribute('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', `${event.user.nickname}${allowedDomain}`)
}
