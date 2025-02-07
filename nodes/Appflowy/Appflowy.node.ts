import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class AppFlowy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AppFlowy',
		name: 'appflowy',
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		icon: 'file:appflowy.svg',
		group: ['transform'],
		version: 1,
		description: 'Consume AppFlowy API',
		defaults: {
			name: 'AppFlowy',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'appflowyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Workspace',
						value: 'workspace',
					},
				],
				default: 'workspace',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['workspace'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many workspaces',
						action: 'Get many workspaces',
					},
				],
				default: 'getAll',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('appflowyApi');

		// Get the stored tokens
		const nodeData = this.getWorkflowStaticData('node');
		let accessToken = nodeData.accessToken as string | undefined;

		// Function to perform login and store tokens
		const authenticate = async () => {
			const response = await this.helpers.request({
				method: 'POST',
				url: `${credentials.host}/gotrue/token?grant_type=password`,
				headers: {
					'Content-Type': 'application/json',
				},
				body: {
					email: credentials.username,
					password: credentials.password,
				},
				json: true,
			});

			// Store the tokens
			nodeData.accessToken = response.access_token;
			nodeData.refreshToken = response.refresh_token;
			accessToken = response.access_token;

			return response.access_token;
		};

		// If we don't have an access token, authenticate
		if (!accessToken) {
			accessToken = await authenticate();
		}

		// For each item
		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'workspace') {
					if (operation === 'getAll') {
						// Get workspaces request
						const response = await this.helpers.request({
							method: 'GET',
							url: `${credentials.host}/api/workspace`,
							headers: {
								'Authorization': `Bearer ${accessToken}`,
							},
							json: true,
						});

						returnData.push(...(Array.isArray(response) ? response : [response]));
					}
				}
			} catch (error) {
				// If we get a 401, try to authenticate and retry the request
				if (error.response?.status === 401) {
					try {
						accessToken = await authenticate();
						// Retry the request with new token
						if (resource === 'workspace' && operation === 'getAll') {
							const response = await this.helpers.request({
								method: 'GET',
								url: `${credentials.host}/api/workspace`,
								headers: {
									'Authorization': `Bearer ${accessToken}`,
								},
								json: true,
							});
							returnData.push(...(Array.isArray(response) ? response : [response]));
							continue;
						}
					} catch (retryError) {
						if (this.continueOnFail()) {
							returnData.push({ error: retryError.message });
							continue;
						}
						throw new NodeOperationError(this.getNode(), retryError, {
							itemIndex: i,
						});
					}
				}

				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, {
					itemIndex: i,
				});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
