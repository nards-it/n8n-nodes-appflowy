import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { appflowyApiRequest, toOptions, getRowDetails } from './GenericFunctions';
import type { Database, LoadedResource, Workspace, PropertySelectValue, DateTimeCell } from './types';
import moment from 'moment-timezone';
import { DateTime } from 'luxon';

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
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
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
				default: 'databaseRow',
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
					loadOptionsDependsOn: ['workspaceId'],
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
						name: 'Create or Update',
						value: 'upsert',
						description: 'Create a new record, or update the current one if it already exists (upsert)',
						action: 'Create or update a database row',
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
				displayName: 'Database Row Pre-Hash',
				name: 'databaseRowPreHash',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['databaseRow'],
						operation: ['upsert'],
					},
				},
				default: '',
				required: true,
				description: 'A string value that that will be used to calculate the hash of the row, which will become the row\'s unique identifier',
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
						operation: ['create', 'upsert'],
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
						operation: ['create', 'upsert'],
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
								name: 'key', // must be named "key" in order to map custom field types
								type: 'options',
								description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
								typeOptions: {
									loadOptionsDependsOn: ['databaseId'],
									loadOptionsMethod: 'getDatabaseFields',
								},
								default: '',
							},
							// Supported Field Types: RichText, Numbers, SingleSelect, MultiSelect, DateTime, Media, URL, Checkbox, Checklist
							// LastEditedTime, CreatedTime, Summary, Translate are read only
							// Relation currently not supported by rows endpoint
							// Media and Checklist not implemented yet
							{
								displayName: 'Type',
								name: 'type',
								type: 'hidden',
								default: '={{$parameter["&key"].split("|")[1]}}',
							},
							{
								displayName: 'Text',
								name: 'textValue',
								type: 'string',
								displayOptions: {
									show: {
										type: ['RichText'],
									},
								},
								default: '',
							},
							{
								displayName: 'Number',
								name: 'numberValue',
								displayOptions: {
									show: {
										type: ['Number'],
									},
								},
								type: 'number',
								default: 0,
								description: 'Number value',
							},
							{
								displayName: 'Option Name or ID',
								name: 'selectValue',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getPropertySelectValues',
								},
								displayOptions: {
									show: {
										type: ['SingleSelect'],
									},
								},
								default: '',
								description: 'Name of the option you want to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
							},
							{
								displayName: 'Option Names or IDs',
								name: 'multiSelectValue',
								type: 'multiOptions',
								typeOptions: {
									loadOptionsMethod: 'getPropertySelectValues',
								},
								displayOptions: {
									show: {
										type: ['MultiSelect'],
									},
								},
								default: [],
								description: 'Name of the options you want to set. Multiples can be defined separated by comma. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
							},
							{
								displayName: 'Range',
								name: 'range',
								displayOptions: {
									show: {
										type: ['DateTime'],
									},
								},
								type: 'boolean',
								default: false,
								description: 'Whether or not you want to define a date range',
							},
							{
								displayName: 'Include Time',
								name: 'includeTime',
								displayOptions: {
									show: {
										type: ['DateTime'],
									},
								},
								type: 'boolean',
								default: true,
								description: 'Whether or not to include the time in the date',
							},
							{
								displayName: 'Date',
								name: 'date',
								displayOptions: {
									show: {
										range: [false],
										type: ['DateTime'],
									},
								},
								type: 'dateTime',
								default: '',
								description: 'An ISO 8601 format date, with optional time',
							},
							{
								displayName: 'Date Start',
								name: 'dateStart',
								displayOptions: {
									show: {
										range: [true],
										type: ['DateTime'],
									},
								},
								type: 'dateTime',
								default: '',
								description: 'An ISO 8601 format date, with optional time',
							},
							{
								displayName: 'Date End',
								name: 'dateEnd',
								displayOptions: {
									show: {
										range: [true],
										type: ['DateTime'],
									},
								},
								type: 'dateTime',
								default: '',
								description:
									'An ISO 8601 formatted date, with optional time. Represents the end of a date range.',
							},
							{
								displayName: 'Timezone Name or ID',
								name: 'timezone',
								type: 'options',
								displayOptions: {
									show: {
										type: ['DateTime'],
									},
								},
								typeOptions: {
									loadOptionsMethod: 'getTimezones',
								},
								default: '',
								description: 'Time zone to use. By default n8n timezone is used. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
							},
							{
								displayName: 'URL',
								name: 'urlValue',
								type: 'string',
								displayOptions: {
									show: {
										type: ['URL'],
									},
								},
								default: '',
							},
							{
								displayName: 'Checked',
								name: 'checkboxValue',
								displayOptions: {
									show: {
										type: ['Checkbox'],
									},
								},
								type: 'boolean',
								default: false,
								description:
									'Whether or not the checkbox is checked. <code>true</code> represents checked. <code>false</code> represents unchecked.',
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
						operation: ['create', 'upsert'],
						dataToSend: ['json'],
					},
				},
				default: '{\n  "cells": {\n    "Field1": "Content",\n    "Field2": "Content"\n  }\n}',
				required: true,
				description: 'The set of columns as JSON data to send',
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
						operation: ['create', 'upsert'],
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

				// Map the response to include id + "|" + field_type for the value
				const fieldsForOptions = response.data
					.filter((field: { field_type: string }) =>
						// LastEditedTime, CreatedTime, S are read only
        		// Relation currently not supported by rows endpoint
						// Media and Checklist not implemented yet
						!['LastEditedTime', 'CreatedTime', 'Summary', 'Translate', 'Relation', 'Media', 'Checklist'].includes(field.field_type)
					)
					.map((field: { id: string; name: string; field_type: string }) => {
						return {
							name: field.name,
							id: `${field.id}|${field.field_type}`,
						};
					});

				return toOptions(fieldsForOptions);
			},
			async getPropertySelectValues(this: ILoadOptionsFunctions) {
				const [name] = (this.getCurrentNodeParameter('&key') as string).split('|');
				const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
				const databaseId = this.getNodeParameter('databaseId', 0) as string;
				const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/fields`;
				const response = await appflowyApiRequest.call(this, 'GET', endpoint);
				const fieldsForOptions = response.data
					.filter((field: { id: string; name: string }) => field.id === name)
					.flatMap((field: { type_option: { content: { options: { name: string; id: string }[] } } }) =>
						field.type_option.content.options
					)
					.map((option: { id: string; name: string }) => ({ id: option.name, name: option.name }));
				return toOptions(fieldsForOptions);
			},
			async getTimezones(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				for (const timezone of moment.tz.names()) {
					const timezoneName = timezone;
					const timezoneId = timezone;
					returnData.push({
						name: timezoneName,
						value: timezoneId,
					});
				}
				returnData.unshift({
					name: 'Default',
					value: '',
					description: 'Timezone set in n8n',
				});
				return returnData;
			}
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
						const workspaceId = this.getNodeParameter('workspaceId', i) as string;

						const endpoint = `/api/workspace/${workspaceId}/database`;
						const response = await appflowyApiRequest.call(this, 'GET', endpoint);
						returnData.push(...response.data);
					}
					if (operation === 'getFields') {
						const workspaceId = this.getNodeParameter('workspaceId', i) as string;
						const databaseId = this.getNodeParameter('databaseId', i) as string;
						const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/fields`;
						const response = await appflowyApiRequest.call(this, 'GET', endpoint);
						returnData.push(...response.data);
					}
				}
				if (resource === 'databaseRow') {
					const workspaceId = this.getNodeParameter('workspaceId', i) as string;
					const databaseId = this.getNodeParameter('databaseId', i) as string;
					if (operation === 'create' || operation === 'upsert') {
						const dataToSend = this.getNodeParameter('dataToSend', i) as string;
						const includeDocumentData = this.getNodeParameter('includeDocumentData', i) as boolean;
						let body: IDataObject = {};
						if (dataToSend === 'mapManually') {
							const fieldValues = this.getNodeParameter('propertiesToSend', i, []) as {
								fieldValues: PropertySelectValue;
							};
							if (!fieldValues.fieldValues) {
								throw new NodeOperationError(this.getNode(), 'No field values provided');
							}
							const cells = fieldValues.fieldValues.reduce((acc, field) => {
								const id = field.key.split('|')[0];
								let value: string | number | boolean | DateTimeCell | null = null;

								switch (field.type) {
									case 'RichText':
										value = field.textValue;
										break;
									case 'Number':
										value = field.numberValue;
										break;
									case 'SingleSelect':
										value = field.selectValue;
										break;
									case 'MultiSelect':
										value = field.multiSelectValue;
										break;
									case 'DateTime': {
										let timezone = this.getTimezone();
										if (field.timezone !== '') {
											timezone = field.timezone;
										}
										if (field.range) {
											if (!field.dateStart || !field.dateEnd) throw new NodeOperationError(this.getNode(), 'Missing date values');
											value = {
												timestamp: DateTime.fromISO(field.dateStart, { zone: timezone }).toUTC().toSeconds().toString(),
												end_timestamp: DateTime.fromISO(field.dateEnd, { zone: timezone }).toUTC().toSeconds().toString(),
												is_range: true,
											};
										} else {
											if (!field.date) throw new NodeOperationError(this.getNode(), 'Missing date value');
											value = {
												timestamp: DateTime.fromISO(field.date, { zone: timezone }).toUTC().toSeconds().toString(),
											};
										}
										if (field.includeTime) {
											value.include_time = true;
										}
										break;
									}
									case 'URL':
										value = field.urlValue;
										break;
									case 'Checkbox':
										value = field.checkboxValue;
										break;
									default:
										value = null; // Handle other types if necessary
								}

								if (value !== null) {
									acc[id] = value;
								}
								return acc;
							}, {} as Record<string, string | number | boolean | DateTimeCell>);

							body = {
								cells: cells,
							};
						}
						if (dataToSend === 'json') {
							body = JSON.parse(this.getNodeParameter('jsonData', i) as string);
						}
						if (includeDocumentData) {
							const documentData = this.getNodeParameter('documentData', i) as string;
							body.document = documentData;
						}
						let requestMethod: IHttpRequestMethods = 'POST';
						if (operation === 'upsert') {
							requestMethod = 'PUT';
							body.pre_hash = this.getNodeParameter('databaseRowPreHash', i) as string;
						}
						const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row`;
						const response = await appflowyApiRequest.call(this, requestMethod, endpoint, body);
						returnData.push({ json: response });
					}
					if (operation === 'get') {
						const ids = this.getNodeParameter('databaseRowId', i) as string;
						const includeDocumentData = this.getNodeParameter('includeDocumentData', i) as boolean;
						const simplify = this.getNodeParameter('simplify', i) as boolean;
						const detailResponse = await getRowDetails.call(this, workspaceId, databaseId, ids, includeDocumentData, simplify);
						returnData.push(...detailResponse);
					}
					if (operation === 'getAll') {
						const includeDocumentData = this.getNodeParameter('includeDocumentData', i) as boolean;
						const simplify = this.getNodeParameter('simplify', i) as boolean;
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filterType = this.getNodeParameter('filterType', i) as string;
						// Get row ids
						let rows = [];
						// Use different endpoint, if filter is applied
						if (filterType === 'updatedAfter') {
							const createdTimeValue = this.getNodeParameter('createdTimeValue', i) as string;
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
							const limit = this.getNodeParameter('limit', i) as number;
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
