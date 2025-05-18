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
	const accessToken = await getAccessToken.call(this, true);

	this.logger.info("Starting appflowyApiRequest");
	this.logger.info("Printing current stacktrace");
	this.logger.info(JSON.stringify(getStackTrace()));
	this.logger.info("Printing this");
	this.logger.info(JSON.stringify(this));
	this.logger.info("Printing credentials");
	this.logger.info(JSON.stringify(credentials));
	this.logger.info("Printing access token");
	this.logger.info(JSON.stringify(accessToken));

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

	this.logger.info("Caclulated options object");
	this.logger.info(JSON.stringify(Object));

	try {
		this.logger.info("Start first request with options");
		const responseData = await this.helpers.request(options);
		this.logger.info("First request completed");
		this.logger.info(JSON.stringify(responseData));

		// Check if the response status is 401
		if (responseData.status === 401) {
			this.logger.info("First response status was 404. Recreate the access token")
			// Attempt to re-authenticate
			const accessToken = await getAccessToken.call(this, true);
			this.logger.info("Recreated access token");
			this.logger.info(JSON.stringify(accessToken));
			this.logger.info("Printing this");
			this.logger.info(JSON.stringify(this));
			// Ensure headers is defined
			if (!options.headers) {
				options.headers = {};
			}
			// Update the options with the new access token and retry the request
			options.headers.Authorization = `Bearer ${accessToken}`;
			this.logger.info("Recreated options");
			this.logger.info(JSON.stringify(options));
			this.logger.info("Start second request with options")
			const retryResponseData = await this.helpers.request(options);
			this.logger.info("Second request completed");
			this.logger.info(JSON.stringify(retryResponseData));
			return retryResponseData;
		}

		return responseData;
	} catch (error) {
		this.logger.info("Entered into catch");
		this.logger.error(JSON.stringify(error));
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

	this.logger.info("getAccessToken started");

	this.logger.info("Printing nodeData");
	this.logger.info(JSON.stringify(nodeData));

	this.logger.info("Printing this");
	this.logger.info(JSON.stringify(this));

	const credentials = await this.getCredentials('appflowyApi');
	this.logger.info("Printing credentials");
	this.logger.info(JSON.stringify(credentials));

	this.logger.info("Starting accessToken request");
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
	this.logger.info("Completed accessToken request, printing response");
	this.logger.info(JSON.stringify(response));


	// Store the tokens in workflow static data
	nodeData.accessToken = response.access_token;
	nodeData.refreshToken = response.refresh_token;

	this.logger.info("Printing nodeData");
	this.logger.info(JSON.stringify(nodeData));

	this.logger.info("Printing this");
	this.logger.info(JSON.stringify(this));

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
	this.logger.info("Started getRowDetails");

	this.logger.info("Printing this");
	this.logger.info(JSON.stringify(this));

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
		this.logger.info("Completed getRowDetails");
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