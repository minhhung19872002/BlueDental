// TODO: Define system settings types.

export interface SystemSettingDto {
  key: string;
  value: string;
  displayName: string;
  description: string | null;
  category: string;
}
