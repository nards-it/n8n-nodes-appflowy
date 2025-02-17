import type {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { appflowyApiRequest, getRowDetails, toOptions } from './GenericFunctions';
import type { Database, LoadedResource, Workspace } from './types';
import moment from 'moment-timezone';

export class AppflowyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AppFlowy Trigger',
		name: 'appflowyTrigger',
		subtitle: '={{$parameter["event"]}}',
		icon: 'file:appflowy.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when AppFlowy events occur',
		defaults: {
			name: 'AppFlowy Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'appflowyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Row Added to Database',
						value: 'rowAddedToDatabase',
					},
					{
						name: 'Row Updated in Database',
						value: 'rowUpdatedInDatabase',
					},
				],
				required: true,
				default: 'rowAddedToDatabase',
			},
			{
				displayName:
					'Be aware that it may take up to one minute for a changed row to be reflected in the API response',
				name: 'appflowyNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						event: ['rowUpdatedInDatabase'],
					},
				},
			},
			{
				displayName: 'Workspace Name or ID',
				name: 'workspaceId',
				type: 'options',
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
				default: false,
				description: 'Whether to include the document data of each row',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified version of the response instead of the raw data',
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const webhookData = this.getWorkflowStaticData('node');
		const event = this.getNodeParameter('event', 0) as string;
		const workspaceId = this.getNodeParameter('workspaceId', 0) as string;
		const databaseId = this.getNodeParameter('databaseId', 0) as string;
		const includeDocumentData = this.getNodeParameter('includeDocumentData', 0) as boolean;
		const simplify = this.getNodeParameter('simplify', 0) as boolean;
		let ids = '';

		if (event === 'rowUpdatedInDatabase') {
			// get lastTimeChecked (or NOW)
			const lastTimeChecked = webhookData.lastTimeChecked
				? moment(webhookData.lastTimeChecked as string)
				: moment().utc();

			// update lastTimeChecked to NOW
			const now = moment().utc();
			webhookData.lastTimeChecked = now;

			// get rows updated after lastTimeChecked minus 1 minute grace period
			// timestamps via API are different from last modified timestamp in app by ~30-60 seconds
			const updatedTimeReference = lastTimeChecked.clone().subtract(1, "minutes").format("YYYY-MM-DDTHH:mm:ss");
			const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row/updated?after=${updatedTimeReference}Z`;
			const response = await appflowyApiRequest.call(this, 'GET', endpoint);
			const rows = response.data;

			if (!webhookData.rows) {
				webhookData.rows = [];
			}

			// filter out rows which have been processed before
			let storedRows = webhookData.rows as Array<{ row_id: string; updated_at: string }>;
			const changedRows = rows.filter((row: { row_id: string; updated_at: string }) => {
				const existingRow = storedRows.find((r) => r.row_id === row.row_id);
				return !existingRow || existingRow.updated_at !== row.updated_at;
			});

			// store/update items in list with id and returned timestamp
			for (const changedRow of changedRows) {
				const existingRowIndex = storedRows.findIndex((r) => r.row_id === changedRow.row_id);
				if (existingRowIndex > -1) {
					storedRows[existingRowIndex] = changedRow;
				} else {
					storedRows.push(changedRow);
				}
			}

			// cleanup list (delete items which have a timestamp older than now minus 2 minutes grace period)
			const secondsSinceLastCheck = now.diff(lastTimeChecked, 'seconds');
			storedRows = storedRows.filter((row) => {
				const rowTimestamp = moment(row.updated_at);
				const now = moment();
				const gracePeriod = secondsSinceLastCheck + (2 * 60);
				return now.diff(rowTimestamp, 'seconds') <= gracePeriod;
			});

			webhookData.rows = storedRows;

			if (changedRows.length > 0) {
				ids = changedRows.map((row: { row_id: string }) => row.row_id).join(',');
			} else {
				return null;
			}

		} else if (event === 'rowAddedToDatabase') {
			// since there is no created after endpoint, all ids need to be stored between executions
			// this may become inperformant on huge databases

			// if the workflow is executed manually, there is no way to determine if there are new rows
			if (this.getMode() === 'manual') {
				return null;
			}

			// get all ids
			const endpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row`;
			const response = await appflowyApiRequest.call(this, 'GET', endpoint);
			const rows = response.data;
			const rowIds = rows.map((row: { id: string }) => row.id);

			// initialize rowIds if not set
			if (!webhookData.rowIds) {
				webhookData.rowIds = rowIds;
			}

			// filter out ids which have already been processed
			const storedRowIds = webhookData.rowIds as string[];
			const newRowIds = rowIds.filter((id: string) => !storedRowIds.includes(id));

			// overwrite all ids
			webhookData.rowIds = rowIds;

			// return all ids which are not in list
			if (newRowIds.length > 0) {
				ids = newRowIds.join(',');
			} else {
				return null;
			}
		}

		// Get details for each row
		const detailResponse = await getRowDetails.call(this, workspaceId, databaseId, ids, includeDocumentData, simplify);

		// return all items
		if (Array.isArray(detailResponse) && detailResponse.length) {
			return [this.helpers.returnJsonArray(detailResponse)];
		}

		// return null if no items found
		return null;
	}
}
