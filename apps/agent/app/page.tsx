import React from 'react';
import { CreateListingWizardBody, defaultAgentListingConfig } from '@nestyk/feature-listing';

export default function AgentHomePage() {
  return (
    <div>
      <CreateListingWizardBody config={defaultAgentListingConfig} />
    </div>
  );
}
