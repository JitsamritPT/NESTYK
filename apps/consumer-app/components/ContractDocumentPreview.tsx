import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { tokens } from "@nestyk/ui/native";

export function isPdfDocumentUrl(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

export function ContractDocumentPreview({ url }: { url: string }) {
  if (isPdfDocumentUrl(url)) {
    return (
      <View style={styles.box}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          nestedScrollEnabled
          androidLayerType="software"
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator color={tokens.colors.primary} />
            </View>
          )}
        />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Image source={{ uri: url }} style={styles.image} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },
  webview: {
    width: "100%",
    height: 480,
    backgroundColor: "#F8FAFC",
  },
  image: {
    width: "100%",
    height: 480,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});
