import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { appflowyApiRequest, toOptions, getRowDetails } from './GenericFunctions';
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
						name: 'Create',
						value: 'create',
						description: 'Create a database row',
						action: 'Create a database row',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a database row',
						action: 'Get a database row',
					},
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
				displayName: 'Data to Send',
				name: 'dataToSend',
				type: 'options',
				options: [
					{
						name: 'Map Manually',
						value: 'mapManually',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['create'],
					},
				},
				default: 'mapManually',
			},
			{
				displayName: 'Properties to Send',
				name: 'propertiesToSend',
				placeholder: 'Add Property',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add Property to Send',
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['create'],
						dataToSend: ['mapManually'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Field',
						name: 'fieldValues',
						values: [
							{
								displayName: 'Property Name or ID',
								name: 'propertyId',
								type: 'options',
								description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
								typeOptions: {
									loadOptionsDependsOn: ['databaseId'],
									loadOptionsMethod: 'getDatabaseFields',
								},
								default: '',
							},
							{
								displayName: 'Property Value',
								name: 'propertyValue',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'JSON Data',
				name: 'jsonData',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['create'],
						dataToSend: ['json'],
					},
				},
				default: '',
				required: true,
				description: 'The set of columns as JSON data to send',
			},
			{
				displayName: 'Database Row ID',
				name: 'databaseRowId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['get'],
					},
				},
				default: '',
				required: true,
				description: 'The ID of the database row to get',
			},
			{
				displayName: 'Include Document Data',
				name: 'includeDocumentData',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
					},
				},
				default: false,
				description: 'Whether to include the document data of each row',
			},
			{
				displayName: 'Document Data',
				name: 'documentData',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['create'],
						includeDocumentData: [true],
					},
				},
				default: '',
				required: true,
				description: 'The document data of the database row (accepts Markdown)',
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
						operation: ['get', 'getAll'],
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
			async getDatabaseFields(this: ILoadOptionsFunctions) {
				const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
				const databaseId = this.getNodeParameter('databaseId', 0) as string;
				const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/fields`;
				const response = await appflowyApiRequest.call(this, 'GET', endpoint);
				return toOptions(response.data);
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
					const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
					const databaseId = this.getNodeParameter('databaseId', 0) as string;
					if (operation === 'create') {
						const dataToSend = this.getNodeParameter('dataToSend', 0) as string;
						const includeDocumentData = this.getNodeParameter('includeDocumentData', 0) as boolean;
						let body: IDataObject = {};
						if (dataToSend === 'mapManually') {
							const propertiesToSend = this.getNodeParameter('propertiesToSend', 0) as {
								fieldValues: Array<{ propertyId: string; propertyValue: string }>;
							};
							if (Object.keys(propertiesToSend).length === 0) {
								throw new NodeOperationError(this.getNode(), "Invalid request - Please define properties first");
							}
							body = {
								cells: propertiesToSend.fieldValues.reduce((acc, property) => {
									acc[property.propertyId] = property.propertyValue;
									return acc;
								}, {} as IDataObject),
							};
						}
						if (dataToSend === 'json') {
							body = JSON.parse(this.getNodeParameter('jsonData', 0) as string);
						}
						if (includeDocumentData) {
							const documentData = this.getNodeParameter('documentData', 0) as string;
							body.document = documentData;
						}
						const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row`;
						const response = await appflowyApiRequest.call(this, 'POST', endpoint, body);
						returnData.push({ json: response });
					}
					if (operation === 'get') {
						const ids = this.getNodeParameter('databaseRowId', 0) as string;
						const includeDocumentData = this.getNodeParameter('includeDocumentData', 0) as boolean;
						const simplify = this.getNodeParameter('simplify', 0) as boolean;
						const detailResponse = await getRowDetails.call(this, workspaceId, databaseId, ids, includeDocumentData, simplify);
						returnData.push(...detailResponse);
					}
					if (operation === 'getAll') {
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
						const detailResponse = await getRowDetails.call(this, workspaceId, databaseId, ids, includeDocumentData, simplify);
						returnData.push(...detailResponse);
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
