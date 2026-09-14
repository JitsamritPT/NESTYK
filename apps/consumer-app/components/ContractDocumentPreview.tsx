import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { isPdfDocumentUrl, pdfViewerHtml } from "../lib/pdf-viewer/html";
export { isPdfDocumentUrl } from "../lib/pdf-viewer/html";

export function ContractDocumentPreview({ url }: { url: string }) {
  const html = useMemo(
    () => (isPdfDocumentUrl(url) ? pdfViewerHtml(url) : null),
    [url],
  );
  const [retry, setRetry] = useState(0);
  return (
    <View style={styles.box}>
      {html ? (
        <WebView
          key={`${url}-${retry}`}
          source={{ html }}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(request) =>
            request.url === "about:blank" ||
            request.url.startsWith("about:blank#")
          }
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          style={styles.viewer}
          startInLoadingState
          onMessage={() => {}}
          renderLoading={() => (
            <View style={styles.overlay}>
              <ActivityIndicator />
            </View>
          )}
          renderError={() => (
            <View style={styles.overlay}>
              <Text>ไม่สามารถเปิดเอกสารได้</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetry((value) => value + 1)}
              >
                <Text>ลองอีกครั้ง</Text>
              </Pressable>
            </View>
          )}
        />
      ) : (
        <Image
          source={{ uri: url }}
          style={styles.image}
          contentFit="contain"
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: 240,
    backgroundColor: "#EEF2F5",
    overflow: "hidden",
  },
  viewer: { flex: 1, backgroundColor: "#EEF2F5" },
  image: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#EEF2F5",
  },
});
