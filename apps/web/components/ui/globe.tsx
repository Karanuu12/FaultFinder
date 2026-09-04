"use client";

import * as React from "react";
import createGlobe from "cobe";

import { cn } from "@/lib/utils";

export function Globe({
  className,
  config,
  style,
  autoRotate = false,
  animationSpeed = 1,
  rotateLatitude = 30,
  rotateLongitude = -30,
}: {
  className?: string;
  config?: Record<string, unknown> & {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    baseColor?: [number, number, number];
    markerColor?: [number, number, number];
    glowColor?: [number, number, number];
    markers?: { location: [number, number]; size: number }[];
    dark?: number;
    diffuse?: number;
  };
  style?: React.CSSProperties;
  autoRotate?: boolean;
  animationSpeed?: number;
  rotateLatitude?: number;
  rotateLongitude?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const globe = createGlobe(canvas, {
      width: (config?.width ?? 800) * 2,
      height: (config?.height ?? 800) * 2,
      devicePixelRatio: 2,
      phi: 0,
      theta: 0,
      dark: 0,
      diffuse: 0.45,
      mapSamples: 16000,
      mapBrightness: 1.15,
      baseColor: [0.92, 0.9, 1],
      markerColor: [0.37, 0.16, 0.77],
      glowColor: [0.95, 0.93, 1],
      markers: [],
      ...config,
    });

    let phi = rotateLatitude * (Math.PI / 180);
    let theta = rotateLongitude * (Math.PI / 180);

    let rotationHandle = 0;
    const rotate = () => {
      requestAnimationFrame(() => {
        if (autoRotate) {
          phi += 0.002 * animationSpeed;
          theta += 0.002 * animationSpeed;
        }
        globe.update({ phi, theta });
        rotationHandle = requestAnimationFrame(rotate);
      });
    };

    rotationHandle = requestAnimationFrame(rotate);

    return () => {
      if (rotationHandle) cancelAnimationFrame(rotationHandle);
      globe.destroy();
    };
  }, [config, autoRotate, animationSpeed, rotateLatitude, rotateLongitude]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("relative mx-auto w-full max-w-[600px]", className)}
      style={
        {
          width: "100%",
          aspectRatio: "1/1",
          contain: "layout paint size",
          ...style,
        } as React.CSSProperties
      }
    />
  );
}
