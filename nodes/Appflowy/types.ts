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
