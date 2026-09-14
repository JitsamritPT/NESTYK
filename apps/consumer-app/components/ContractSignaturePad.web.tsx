import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@nestyk/ui/native";
import type { ContractSignaturePadHandle } from "./ContractSignaturePad";

export type { ContractSignaturePadHandle };

export const ContractSignaturePad = forwardRef<
  ContractSignaturePadHandle,
  { onOK: (image: string) => void; onEmpty: () => void }
>(function ContractSignaturePad({ onOK, onEmpty }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  useImperativeHandle(ref, () => ({
    readSignature: () => {
      const canvas = canvasRef.current;
      if (!canvas || !dirty.current) {
        onEmpty();
        return;
      }
      onOK(canvas.toDataURL("image/png"));
    },
    clearSignature: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
    },
    reinitialize: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
      drawing.current = false;
    },
  }));

  return (
    <View style={styles.box}>
      {React.createElement("canvas", {
        ref: canvasRef,
        width: 720,
        height: 320,
        style: {
          width: "100%",
          height: 220,
          touchAction: "none",
          display: "block",
        },
        onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => {
          const ctx = canvasRef.current?.getContext("2d");
          const p = point(event);
          if (!ctx || !p) return;
          drawing.current = true;
          ctx.strokeStyle = tokens.colors.primary;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          const p = point(event);
          if (!ctx || !p) return;
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        },
        onPointerUp: () => {
          drawing.current = false;
        },
      })}
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
});
