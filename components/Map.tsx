"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    lng: number;
    lat: number;
    title?: string;
    description?: string;
  }>;
  height?: string;
  onMapClick?: (lng: number, lat: number) => void;
}

export default function Map({
  center = [116.4, 39.9],
  zoom = 12,
  markers = [],
  height = "400px",
  onMapClick,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!accessToken) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: zoom,
      projection: "mercator",
      // 限制地图范围在中国境内
      maxBounds: [
        [73.5, 18.0],
        [135.0, 54.0],
      ],
      minZoom: 3,
      maxZoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    if (onMapClick) {
      map.current.on("click", (e) => {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center, zoom, onMapClick]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const existingMarkers = document.querySelectorAll(".mapboxgl-marker");
    existingMarkers.forEach((marker) => marker.remove());

    markers.forEach((markerInfo) => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<h3 style="font-weight: bold; margin-bottom: 4px;">${markerInfo.title || "位置"}</h3>
         <p style="margin: 0; font-size: 14px;">${markerInfo.description || ""}</p>`
      );

      new mapboxgl.Marker({ color: "#EF4444" })
        .setLngLat([markerInfo.lng, markerInfo.lat])
        .setPopup(popup)
        .addTo(map.current!);
    });

    if (markers.length === 1) {
      map.current.flyTo({
        center: [markers[0].lng, markers[0].lat],
        zoom: 15,
        essential: true,
      });
    } else if (markers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach((marker) => {
        bounds.extend([marker.lng, marker.lat]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [markers, mapLoaded]);

  return <div ref={mapContainer} style={{ height, width: "100%" }} />;
}
