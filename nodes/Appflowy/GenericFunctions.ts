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
	const accessToken = await getAccessToken.call(this);

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

		// Check if the response status is 401
		if (responseData.status === 401) {
			// Attempt to re-authenticate
			const accessToken = await getAccessToken.call(this, true);
			// Ensure headers is defined
			if (!options.headers) {
				options.headers = {};
			}
			// Update the options with the new access token and retry the request
			options.headers.Authorization = `Bearer ${accessToken}`;
			const retryResponseData = await this.helpers.request(options);
			return retryResponseData;
		}

		return responseData;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Authenticate and store tokens.
 */
export async function getAccessToken(this: IExecuteFunctions | ILoadOptionsFunctions, reauthenticate = false): Promise<string> {
	// Check for existing access token
	const nodeData = this.getWorkflowStaticData('node');
	if (typeof nodeData.accessToken === 'string' && !reauthenticate) {
		return nodeData.accessToken;
	}

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
	nodeData.accessToken = response.access_token;
	nodeData.refreshToken = response.refresh_token;

	return response.access_token;
}

export const toOptions = (items: LoadedResource[]) =>
	items.map(({ name, id }) => ({ name, value: id }));

/**
 * Fetch and process row details from AppFlowy API.
 */
export async function getRowDetails(
	this: IExecuteFunctions,
	workspaceId: string,
	databaseId: string,
	ids: string,
	includeDocumentData: boolean,
	simplify: boolean
): Promise<IDataObject[]> {
	const args = includeDocumentData ? '&with_doc=true' : '';
	const detailEndpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row/detail?ids=${ids}${args}`;
	const detailResponse = await appflowyApiRequest.call(this, 'GET', detailEndpoint);

	if (simplify) {
		return detailResponse.data.map((item: { id: string; cells: Record<string, unknown>; doc?: unknown }) => {
			const result: { id: string; doc?: unknown } = { id: item.id };
			Object.assign(result, item.cells);
			if (includeDocumentData) {
				result.doc = null;
				if (item.doc) result.doc = item.doc;
			}
			return result;
		});
	}

	if (!includeDocumentData) {
		return detailResponse.data.map(({ doc, ...rest }: { doc?: unknown; [key: string]: unknown }) => rest);
	}
	return detailResponse.data;
}
