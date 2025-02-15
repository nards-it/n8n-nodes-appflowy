export type LoadedResource = {
	id: number;
	name: string;
};

export type Workspace = {
	workspace_id: string;
	database_storage_id: string;
	owner_uid: number;
	owner_name: string;
	owner_email: string;
	workspace_type: number;
	workspace_name: string;
	created_at: string;
	icon: string;
	member_count: number | null;
	role: string | null;
};

export type Database = {
	id: string;
	views: {
		view_id: string;
		name: string;
		icon: {
			ty: number;
			value: string;
		};
		layout: number;
	}[];
};

export type DateTimeCell = {
	timestamp?: string;
	end_timestamp?: string;
	is_range?: boolean;
	include_time?: boolean;
};

export type PropertySelectValue = {
	key: string;
	type: string;
	textValue: string;
	numberValue: number;
	selectValue: string;
	multiSelectValue: string;
	range: boolean;
	includeTime: boolean;
	date: string;
	dateStart: string;
	dateEnd: string;
	timezone: string;
	urlValue: string;
	checkboxValue: boolean;
}[];

