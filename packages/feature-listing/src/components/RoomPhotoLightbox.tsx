import React from 'react';
import { MobilePhotoViewer, type MobilePhotoViewerLabels } from '@nestyk/ui/native';

export type RoomPhotoLightboxProps = {
  visible: boolean;
  uri: string;
  beforeUri?: string;
  labels: {
    before: string;
    after: string;
    close: string;
  };
  onClose: () => void;
};

/** @deprecated Prefer MobilePhotoViewer from @nestyk/ui/native */
export function RoomPhotoLightbox({ visible, uri, beforeUri, labels, onClose }: RoomPhotoLightboxProps) {
  const hasCompare = !!beforeUri && beforeUri !== uri;
  const viewerLabels: MobilePhotoViewerLabels = {
    titlePreview: 'Photo preview',
    titleCompare: 'Compare photo',
    before: labels.before,
    after: labels.after,
    enhancedBadge: 'Enhanced',
    enhancedCaption: 'Enhanced preview',
    hintZoom: 'Pinch to zoom · Swipe or tap arrows to change photo',
    hintCompareSwitch: 'Switch views to compare the same photo',
    hintCompareClose: 'Preview only · Close to return',
    closeA11y: labels.close,
  };

  return (
    <MobilePhotoViewer
      visible={visible}
      mode={hasCompare ? 'compare' : 'gallery'}
      items={[{ uri, beforeUri, enhanced: hasCompare }]}
      index={0}
      beforeUri={beforeUri}
      afterUri={uri}
      initialSide="after"
      labels={viewerLabels}
      onClose={onClose}
    />
  );
}
