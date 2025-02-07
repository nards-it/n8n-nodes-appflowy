import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// https://github.com/AppFlowy-IO/AppFlowy-Docs/blob/main/documentation/appflowy-cloud/openapi/Apis/OAuthApi.md#gotruetoken

export class AppFlowyApi implements ICredentialType {
	name = 'appflowyApi';

	displayName = 'AppFlowy API';

	documentationUrl = 'https://github.com/octionic/n8n-nodes-appflowy';

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