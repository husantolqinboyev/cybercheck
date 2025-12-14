import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface AttendanceRecord {
  id: string;
  student_name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  check_in_time: string | null;
}

interface AttendanceMapProps {
  lessonLat: number;
  lessonLng: number;
  radiusMeters: number;
  attendance: AttendanceRecord[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "present":
      return "#22c55e";
    case "absent":
      return "#ef4444";
    case "excused":
      return "#3b82f6";
    case "unexcused":
      return "#f59e0b";
    case "suspicious":
      return "#f97316";
    default:
      return "#6b7280";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "present": return "Keldi";
    case "absent": return "Kelmadi";
    case "excused": return "Sababli";
    case "unexcused": return "Sababsiz";
    case "suspicious": return "Shubhali";
    default: return status;
  }
};

export const AttendanceMap = ({
  lessonLat,
  lessonLng,
  radiusMeters,
  attendance,
}: AttendanceMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView(
        [lessonLat, lessonLng],
        16
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    // Add tile layer if not exists
    let hasTileLayer = false;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        hasTileLayer = true;
      }
    });
    if (!hasTileLayer) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }

    // Add lesson location marker (teacher)
    const teacherIcon = L.divIcon({
      html: `<div style="background: #6366f1; border: 3px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([lessonLat, lessonLng], { icon: teacherIcon })
      .addTo(map)
      .bindPopup("<b>Dars joylashuvi</b>");

    // Add radius circle
    L.circle([lessonLat, lessonLng], {
      radius: radiusMeters,
      color: "#6366f1",
      fillColor: "#6366f1",
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    // Add student markers
    attendance.forEach((record) => {
      if (record.latitude && record.longitude) {
        const color = getStatusColor(record.status);
        const studentIcon = L.divIcon({
          html: `<div style="background: ${color}; border: 2px solid white; border-radius: 50%; width: 18px; height: 18px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        L.marker([record.latitude, record.longitude], { icon: studentIcon })
          .addTo(map)
          .bindPopup(`
            <b>${record.student_name}</b><br/>
            <span style="color: ${color}">${getStatusLabel(record.status)}</span><br/>
            ${record.distance_meters ? `Masofa: ${Math.round(record.distance_meters)}m` : ""}
            ${record.check_in_time ? `<br/>Vaqt: ${new Date(record.check_in_time).toLocaleTimeString("uz-UZ")}` : ""}
          `);
      }
    });

    // Fit bounds
    map.setView([lessonLat, lessonLng], 16);

    return () => {
      // Cleanup on unmount
    };
  }, [lessonLat, lessonLng, radiusMeters, attendance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Dars joylashuvi</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="text-muted-foreground">Keldi</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Kelmadi</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-suspicious" />
          <span className="text-muted-foreground">Shubhali</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[400px] rounded-lg border border-border overflow-hidden"
      />
    </div>
  );
};
