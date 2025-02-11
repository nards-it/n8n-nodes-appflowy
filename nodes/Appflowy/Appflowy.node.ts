import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { appflowyApiRequest, toOptions, getAccessToken } from './GenericFunctions';
import type { LoadedResource, Workspace } from './types';

export class Appflowy implements INodeType {
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
					{
						name: 'Database',
						value: 'database',
					},
					{
						name: 'Database Row',
						value: 'databaseRow',
					},
				],
				default: 'workspace',
			},

			// Workspace

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

			// Database

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['database'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many databases',
						action: 'Get many databases',
					},
					{
						name: 'Get Fields',
						value: 'getFields',
						description: 'Get database fields',
						action: 'Get database fields',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Workspace Name or ID',
				name: 'workspaceId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['database'],
					},
				},
				default: '',
				required: true,
				description: 'The name or ID of the workspace to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getWorkspaceIds',
				},
			},

			// Database Row

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['databaseRow'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many database rows',
						action: 'Get many database rows',
					},
				],
				default: 'getAll',
			},
		],
	};

	methods= {
		loadOptions: {
			async getWorkspaceIds(this: ILoadOptionsFunctions) {
				const endpoint = '/api/workspace';
				const response = await appflowyApiRequest.call(this, 'GET', endpoint);

				const workspaces = response.data.map((workspace: Workspace) => ({
					id: workspace.workspace_id,
					name: workspace.workspace_name,
				})) as LoadedResource[];

				return toOptions(workspaces);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get the stored tokens
		const nodeData = this.getWorkflowStaticData('node');
		let accessToken = nodeData.accessToken as string | undefined;

		// If we don't have an access token, authenticate
		if (!accessToken) {
			accessToken = await getAccessToken.call(this);
		}

		// For each item
		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'workspace') {
					if (operation === 'getAll') {
						const endpoint = '/api/workspace';
						const response = await appflowyApiRequest.call(this, 'GET', endpoint);
						returnData.push(...response.data);
					}
				}
				if (resource === 'database') {
					if (operation === 'getAll') {
						const workspaceId = this.getNodeParameter('workspaceId', 0) as string;

						const endpoint = `/api/workspace/${workspaceId}/database`;
						const response = await appflowyApiRequest.call(this, 'GET', endpoint);
						returnData.push(...response.data);
					}
				}
			} catch (error) {
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
