import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { appflowyApiRequest, toOptions } from './GenericFunctions';
import type { Database, LoadedResource, Workspace } from './types';

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
			{
				displayName: 'Database Name or ID',
				name: 'databaseId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['database'],
						operation: ['getFields'],
					},
				},
				default: '',
				required: true,
				description: 'The name or ID of the database to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getDatabaseIds',
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
			{
				displayName: 'Workspace Name or ID',
				name: 'workspaceId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
					},
				},
				default: '',
				required: true,
				description: 'The name or ID of the workspace to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getWorkspaceIds',
				},
			},
			{
				displayName: 'Database Name or ID',
				name: 'databaseId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
					},
				},
				default: '',
				required: true,
				description: 'The name or ID of the database to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsDependsOn: ['workspaceId'],
					loadOptionsMethod: 'getDatabaseIds',
				},
			},
			{
				displayName: 'Include Document Data',
				name: 'includeDocumentData',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
					},
				},
				default: false,
				description: 'Whether to include the document data of each row',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
					},
				},
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
					},
				},
				default: true,
				description: 'Whether to return a simplified version of the response instead of the raw data',
			},
			{
				displayName: 'Filter',
				name: 'filterType',
				type: 'options',
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Updated After',
						value: 'updatedAfter',
					},
				],
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
					},
				},
				default: 'none',
			},
			{
				displayName: 'Updated Time',
				name: 'createdTimeValue',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['getAll'],
						filterType: ['updatedAfter'],
					},
				},
				type: 'dateTime',
				default: '',
				required: true,
				description: 'An ISO 8601 format date, with optional time',
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
			async getDatabaseIds(this: ILoadOptionsFunctions) {
				const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
				const endpoint = `/api/workspace/${workspaceId}/database`;
				const response = await appflowyApiRequest.call(this, 'GET', endpoint);

				const databases = response.data.map((database: Database) => ({
					id: database.id,
					name: database.views[0].name,
				})) as LoadedResource[];

				return toOptions(databases);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

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
					if (operation === 'getFields') {
						const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
						const databaseId = this.getNodeParameter('databaseId', 0) as string;
						const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/fields`;
						const response = await appflowyApiRequest.call(this, 'GET', endpoint);
						returnData.push(...response.data);
					}
				}
				if (resource === 'databaseRow') {
					if (operation === 'getAll') {
						const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
						const databaseId = this.getNodeParameter('databaseId', 0) as string;
						const includeDocumentData = this.getNodeParameter('includeDocumentData', 0) as boolean;
						const simplify = this.getNodeParameter('simplify', 0) as boolean;
						const returnAll = this.getNodeParameter('returnAll', 0) as boolean;
						const filterType = this.getNodeParameter('filterType', 0) as string;
						// Get row ids
						let rows = [];
						// Use different endpoint, if filter is applied
						if (filterType === 'updatedAfter') {
							const createdTimeValue = this.getNodeParameter('createdTimeValue', 0) as string;
							const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row/updated?after=${createdTimeValue}Z`;
							const response = await appflowyApiRequest.call(this, 'GET', endpoint);
							rows = response.data.map((row: { row_id: string }) => ({ id: row.row_id }));
						} else {
							const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row`;
							const response = await appflowyApiRequest.call(this, 'GET', endpoint);
							rows = response.data;
						}
						// Early return if no rows are found
						if (rows.length === 0) {
							return [this.helpers.returnJsonArray([])];
						}
						// Apply limit if needed
						if (!returnAll) {
							const limit = this.getNodeParameter('limit', 0) as number;
							rows = rows.slice(0, limit);
						}
						const ids = rows.map((row: { id: string }) => row.id).join(',');
						// Get details for each row
						const args = includeDocumentData ? '&with_doc=true' : '';
						const detailEndpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row/detail?ids=${ids}${args}`;
						const detailResponse = await appflowyApiRequest.call(this, 'GET', detailEndpoint);
						if (simplify) {
							const simplifiedData = detailResponse.data.map((item: { id: string; cells: Record<string, unknown>; doc?: unknown }) => {
								const result: { id: string; doc?: unknown } = { id: item.id };
								Object.assign(result, item.cells);
								if (includeDocumentData) {
									result.doc = null;
									if (item.doc) result.doc = item.doc;
								}
								return result;
							});
							returnData.push(...simplifiedData);
						} else {
							if (!includeDocumentData) {
								returnData.push(...detailResponse.data.map(({ doc, ...rest }: { doc?: unknown; [key: string]: unknown }) => rest));
							} else {
								returnData.push(...detailResponse.data);
							}
						}
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
