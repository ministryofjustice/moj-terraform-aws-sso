function (user, context, callback) {
  user.awsRole = 'arn:aws:iam::' + configuration.AWS_ACCOUNT_ID + ':role/' + configuration.AWS_ROLE_NAME + ',arn:aws:iam::' + configuration.AWS_ACCOUNT_ID + ':saml-provider/' + configuration.AWS_SAML_PROVIDER_NAME
  user.awsRoleSession = user.name

  context.samlConfiguration.mappings = {
    'https://aws.amazon.com/SAML/Attributes/Role': 'awsRole',
    'https://aws.amazon.com/SAML/Attributes/RoleSessionName': 'awsRoleSession'
  }

  callback(null, user, context)
}
