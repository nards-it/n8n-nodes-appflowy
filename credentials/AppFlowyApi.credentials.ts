import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// https://github.com/AppFlowy-IO/AppFlowy-Docs/blob/main/documentation/appflowy-cloud/openapi/Apis/OAuthApi.md#gotruetoken

export class AppflowyApi implements ICredentialType {
	name = 'appflowyApi';

	displayName = 'AppFlowy API';

	documentationUrl = 'https://github.com/octionic/n8n-nodes-appflowy/blob/master/README.md#Credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: 'https://beta.appflowy.cloud',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
		},
	];
}
