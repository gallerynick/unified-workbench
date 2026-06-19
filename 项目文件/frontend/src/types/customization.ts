export interface AppConfig {
  name: string;
  shortName: string;
  description: string;
}

export interface BrandingConfig {
  logoExpanded: string | null;
  logoCollapsed: string | null;
  favicon: string | null;
}

export interface CustomizationConfig {
  app: AppConfig;
  branding: BrandingConfig;
}

export const DEFAULT_CONFIG: CustomizationConfig = {
  app: {
    name: '一站式工作台',
    shortName: '工',
    description: '面向小团队的内网一体化协作与信息管理平台',
  },
  branding: {
    logoExpanded: null,
    logoCollapsed: null,
    favicon: null,
  },
};
