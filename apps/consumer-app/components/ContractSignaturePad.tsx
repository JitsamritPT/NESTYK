import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import SignatureCanvas, {
  SignatureViewRef,
} from "react-native-signature-canvas";
import { tokens } from "@nestyk/ui/native";

export type ContractSignaturePadHandle = {
  readSignature: () => void;
  clearSignature: () => void;
  /** Remount WebView — needed after opening inside MobileBottomSheet. */
  reinitialize: () => void;
};

const webStyle = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html { background: #F8FAFC; }
`;

export const ContractSignaturePad = forwardRef<
  ContractSignaturePadHandle,
  { onOK: (image: string) => void; onEmpty: () => void }
>(function ContractSignaturePad({ onOK, onEmpty }, ref) {
  return (
    <View style={styles.box}>
      <SignatureCanvas
        ref={ref as React.Ref<SignatureViewRef>}
        onOK={onOK}
        onEmpty={onEmpty}
        autoClear={false}
        imageType="image/png"
        penColor={tokens.colors.primary}
        backgroundColor="rgba(0,0,0,0)"
        webStyle={webStyle}
        nestedScrollEnabled
        androidLayerType="software"
        webviewContainerStyle={styles.webview}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    height: 220,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },
  webview: { flex: 1, backgroundColor: "#F8FAFC" },
});
