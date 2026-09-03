import React from 'react';
import { CreateListingWizardBody, defaultOwnerListingConfig } from '@nestyk/feature-listing';

export default function OwnerHomePage() {
  return (
    <div>
      <CreateListingWizardBody config={defaultOwnerListingConfig} />
    </div>
  );
}
