import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import type { LoadedResource } from './types';

/**
 * Make a request to AppFlowy API.
 */
export async function appflowyApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
) {
	const credentials = await this.getCredentials('appflowyApi');
	const accessToken = await authenticate.call(this);

	const options: IRequestOptions = {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		method,
		body,
		qs,
		uri: `${credentials.host}${endpoint}`,
		json: true,
	};

	if (Object.keys(qs).length === 0) {
		options.qs = undefined;
	}

	if (Object.keys(body).length === 0) {
		options.body = undefined;
	}

	try {
		const responseData = await this.helpers.request(options);

		// Reformat the response data
		const formattedData = responseData.data.map((workspace: any) => ({
			id: workspace.workspace_id,
			name: workspace.workspace_name,
		}));

		return formattedData;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Authenticate and store tokens.
 */
export async function authenticate(this: IExecuteFunctions | ILoadOptionsFunctions) { // TODO: reauthenticate automatically on error 401 - move function over from main script.
	const credentials = await this.getCredentials('appflowyApi');

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

	// Store the tokens in workflow static data
	const nodeData = this.getWorkflowStaticData('node');
	nodeData.accessToken = response.access_token;
	nodeData.refreshToken = response.refresh_token;

	return response.access_token;
}

export const toOptions = (items: LoadedResource[]) =>
	items.map(({ name, id }) => ({ name, value: id }));
