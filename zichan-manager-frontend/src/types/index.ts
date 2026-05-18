export interface User {
  id: number;
  username: string;
  role: string;
  email?: string | null;
  avatar?: string | null;
  created_at: string;
}

export interface FeishuUser {
  id: number;
  username: string;
  role: string;
  email?: string | null;
  avatar?: string | null;
  created_at: string;
}

export interface FeishuTokenResponse {
  access_token: string;
  token_type: string;
  user: FeishuUser;
}

export interface FeishuContactMember {
  name: string;
  email: string | null;
  avatar: string | null;
  open_id: string;
  department_id: string | null;
  department_name: string | null;
}

export interface FeishuDepartmentTree {
  open_department_id: string;
  name: string;
  parent_open_department_id: string | null;
  members: FeishuContactMember[];
  children: FeishuDepartmentTree[];
}

export interface FeishuContactsResponse {
  departments: FeishuDepartmentTree[];
  total_departments: number;
  total_users: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  asset_count: number;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  person_count: number;
  asset_count: number;
}

export interface Person {
  id: number;
  name: string;
  department_id: number | null;
  department_name: string | null;
  created_at: string;
}

export interface PersonWithAssets extends Person {
  assets: Asset[];
}

export interface AssetLog {
  id: number;
  action: string;
  operator_id: number;
  detail: string;
  created_at: string;
}

export interface Asset {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  price: number;
  purchase_date: string;
  status: string;
  person_id: number | null;
  person_name: string | null;
  description: string;
  model: string;
  color: string;
  asset_code: string;
  sn: string;
  created_at: string;
  updated_at: string;
  logs: AssetLog[];
}

export interface DashboardStats {
  total_assets: number;
  in_stock: number;
  checked_out: number;
  disposed: number;
  total_value: number;
  category_stats: { name: string; count: number }[];
  department_stats: { name: string; count: number }[];
}

export interface AssetCreate {
  name: string;
  category_id: number;
  price: number;
  purchase_date: string;
  description: string;
  model: string;
  color: string;
  asset_code: string;
  sn: string;
}

export interface VersionInfo {
  version: string;
  commit: string;
  commit_full: string;
  commit_date: string;
  tag: string;
}

export interface UpdateCheckResult {
  has_update: boolean;
  current_commit?: string;
  latest_commit?: string;
  changes?: string;
  error?: string;
}
