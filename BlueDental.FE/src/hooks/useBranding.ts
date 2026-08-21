// useBranding — fetches clinic-level branding settings (logo, name, colors).
// TODO: Implement when branding API is available.

export interface ClinicBranding {
  clinicName?: string;
  hasLogo: boolean;
}

export const brandingLogoUrl = "/api/v1/public/branding/logo";
export const defaultBrandingLogoUrl = "/bluedental-logo.svg";

/**
 * Returns static defaults until the branding API is implemented.
 */
export function useBranding(): { data: ClinicBranding | undefined } {
  return { data: { hasLogo: false, clinicName: "BlueDental" } };
}
