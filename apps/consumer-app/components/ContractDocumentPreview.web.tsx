import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { tokens } from "@nestyk/ui/native";

export function isPdfDocumentUrl(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

export function ContractDocumentPreview({ url }: { url: string }) {
  if (isPdfDocumentUrl(url)) {
    return (
      <View style={styles.box}>
        {React.createElement("iframe", {
          src: url,
          title: "document preview",
          style: {
            width: "100%",
            height: 480,
            border: "none",
            display: "block",
            backgroundColor: "#F8FAFC",
          },
        })}
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
  image: {
    width: "100%",
    height: 480,
  },
});
