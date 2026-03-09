import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: 'demo_provider',
  exposes: {
    '.': './src/components/ProviderComponent.tsx',
    './CommTestWidget': './src/components/CommTestWidget.tsx',
    './DeployWizardStep1': './src/components/DeployWizardStep1.tsx',
    './DeployWizardStep2': './src/components/DeployWizardStep2.tsx',
    './DeployWizardStep3': './src/components/DeployWizardStep3.tsx',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
