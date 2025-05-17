import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
	JsonObject,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	LoggerProxy as Logger
} from 'n8n-workflow';

import type { LoadedResource } from './types';

/**
 * Make a request to AppFlowy API.
 */
export async function appflowyApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
) {
	const credentials = await this.getCredentials('appflowyApi');
	const accessToken = await getAccessToken.call(this);

	Logger.info("Starting appflowyApiRequest");
	Logger.info("Printing current stacktrace");
	Logger.info(JSON.stringify(getStackTrace()));
	Logger.info("Printing this");
	Logger.info(JSON.stringify(this));
	Logger.info("Printing credentials");
	Logger.info(JSON.stringify(credentials));
	Logger.info("Printing access token");
	Logger.info(JSON.stringify(accessToken));

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

	Logger.info("Caclulated options object");
	Logger.info(JSON.stringify(Object));

	try {
		Logger.info("Start first request with options");
		const responseData = await this.helpers.request(options);
		Logger.info("First request completed");
		Logger.info(JSON.stringify(responseData));

		// Check if the response status is 401
		if (responseData.status === 401) {
			Logger.info("First response status was 404. Recreate the access token")
			// Attempt to re-authenticate
			const accessToken = await getAccessToken.call(this, true);
			Logger.info("Recreated access token");
			Logger.info(JSON.stringify(accessToken));
			Logger.info("Printing this");
			Logger.info(JSON.stringify(this));
			// Ensure headers is defined
			if (!options.headers) {
				options.headers = {};
			}
			// Update the options with the new access token and retry the request
			options.headers.Authorization = `Bearer ${accessToken}`;
			Logger.info("Recreated options");
			Logger.info(JSON.stringify(options));
			Logger.info("Start second request with options")
			const retryResponseData = await this.helpers.request(options);
			Logger.info("Second request completed");
			Logger.info(JSON.stringify(retryResponseData));
			return retryResponseData;
		}

		return responseData;
	} catch (error) {
		Logger.info("Entered into catch");
		Logger.error(JSON.stringify(error));
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Authenticate and store tokens.
 */
export async function getAccessToken(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	reauthenticate = false
): Promise<string> {
	// Check for existing access token
	const nodeData = this.getWorkflowStaticData('node');
	if (typeof nodeData.accessToken === 'string' && !reauthenticate) {
		return nodeData.accessToken;
	}

	Logger.info("getAccessToken started");

	Logger.info("Printing nodeData");
	Logger.info(JSON.stringify(nodeData));

	Logger.info("Printing this");
	Logger.info(JSON.stringify(this));

	const credentials = await this.getCredentials('appflowyApi');
	Logger.info("Printing credentials");
	Logger.info(JSON.stringify(credentials));

	Logger.info("Starting accessToken request");
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
	Logger.info("Completed accessToken request, printing response");
	Logger.info(JSON.stringify(response));


	// Store the tokens in workflow static data
	nodeData.accessToken = response.access_token;
	nodeData.refreshToken = response.refresh_token;

	Logger.info("Printing nodeData");
	Logger.info(JSON.stringify(nodeData));

	Logger.info("Printing this");
	Logger.info(JSON.stringify(this));

	return response.access_token;
}

export const toOptions = (items: LoadedResource[]) =>
	items.map(({ name, id }) => ({ name, value: id }));

/**
 * Fetch and process row details from AppFlowy API.
 */
export async function getRowDetails(
	this: IExecuteFunctions | IPollFunctions,
	workspaceId: string,
	databaseId: string,
	ids: string,
	includeDocumentData: boolean,
	simplify: boolean
): Promise<IDataObject[]> {
	Logger.info("Started getRowDetails");

	Logger.info("Printing this");
	Logger.info(JSON.stringify(this));

	const args = includeDocumentData ? '&with_doc=true' : '';
	const detailEndpoint = `/api/workspace/${workspaceId}/database/${databaseId}/row/detail?ids=${ids}${args}`;
	const detailResponse = await appflowyApiRequest.call(this, 'GET', detailEndpoint);

	try {

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

	} finally {
		Logger.info("Completed getRowDetails");
	}
}

function getStackTrace () {

  var stack;

  try {
    throw new Error('');
  }
  catch (error) {
    stack = error.stack || '';
  }

  return stack;
}