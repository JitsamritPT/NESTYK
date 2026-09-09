import React from 'react';
import { CreateListingWizardBody, defaultAgentListingConfig } from '@nestyk/feature-listing';

export default function AgentCreateListingPage() {
  return (
    <div>
      <CreateListingWizardBody config={defaultAgentListingConfig} />
    </div>
  );
}
