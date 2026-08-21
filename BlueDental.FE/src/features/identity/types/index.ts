// TODO: Define identity management types (User, Role, Permission).

export interface UserDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
}

export interface RoleDto {
  id: string;
  name: string;
  permissions: string[];
}
