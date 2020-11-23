/*
  This role updates an AWS SSO user to their correct groups.
*/
async function (user, context, callback) {
  const allowedDomain = JSON.parse(configuration.ALLOWED_DOMAINS)
  const awsSsoUrl = `https://scim.${JSON.parse(configuration.SSO_REGION)}.amazonaws.com/${JSON.parse(configuration.SSO_TENANT_ID)}/scim/v2`
  const axios = require('axios@0.19.2')
  axios.defaults.headers.common.Authorization = `Bearer ${JSON.parse(configuration.SSO_SCIM_TOKEN)}`

  /*
    Get SSO user ID by username
  */
  const url = `${awsSsoUrl}/Users?filter=userName eq "${user.nickname}${allowedDomain}"`
  const ssoUser = await axios.get(url).then(response => response.data).catch(error => {
    console.log('[error]', error)
  })

  if (ssoUser.totalResults === 1) {
    await Promise.all(
      user.teams.map(async team => {
        const url = `${awsSsoUrl}/Groups?filter=displayName eq "${team}"`
        const ssoGroupId = await axios.get(url).then(response => response.data.Resources[0].id).catch(error => {
          console.log('[error]', error)
        })

        const patchUrl = `${awsSsoUrl}/Groups/${ssoGroupId}`
        await axios.patch(patchUrl, {
          schemas: [
            'urn:ietf:params:scim:api:messages:2.0:PatchOp'
          ],
          Operations: [{
            op: 'add',
            path: 'members',
            value: [{
              value: ssoUser.Resources[0].id
            }]
          }]
        }).catch(error => {
          console.log('[error]', error)
        })
      })
    )

    return callback(null, user, context)
  } else {
    return callback(new UnauthorizedError('Access denied: user does not exist in AWS SSO:', user))
  }
}
