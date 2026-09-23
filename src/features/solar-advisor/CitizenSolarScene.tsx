"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { CitizenSolarInput, RoofSize } from "@/lib/citizen-solar";
import { cn } from "@/lib/utils";

type PropertyType = CitizenSolarInput["propertyType"];
type SceneView = "perspective" | "front" | "top";

const PROPERTY_LABELS: Record<PropertyType, string> = {
  townhouse: "Nhà phố hiện đại",
  villa: "Biệt thự sân vườn",
  garden: "Nhà vườn mái dốc",
  business: "Cửa hàng / nhà xưởng",
};

const ROOF_LABELS: Record<RoofSize, string> = {
  small: "Mái nhỏ khoảng 24 m²",
  medium: "Mái vừa khoảng 45 m²",
  large: "Mái lớn khoảng 80 m²",
  custom: "Diện tích mái tùy chỉnh",
};

const VIEWS: Array<{ value: SceneView; label: string }> = [
  { value: "perspective", label: "Phối cảnh" },
  { value: "front", label: "Mặt tiền" },
  { value: "top", label: "Mặt bằng" },
];

function CameraRig({ view }: { view: SceneView }) {
  const { camera } = useThree();
  useEffect(() => {
    const positions: Record<SceneView, [number, number, number]> = {
      perspective: [11.5, 8.5, 13],
      front: [0, 5.2, 16],
      top: [0.01, 18, 0.01],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, 1.65, 0);
  }, [camera, view]);
  return null;
}

function Window({ position, scale = [1.15, 0.9, 0.12] as [number, number, number] }: { position: [number, number, number]; scale?: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={scale} /><meshStandardMaterial color="#e8eef2" roughness={0.42} /></mesh>
      <mesh position={[0, 0, scale[2] / 2 + 0.012]}><boxGeometry args={[scale[0] * 0.82, scale[1] * 0.8, 0.025]} /><meshStandardMaterial color="#78b9d2" metalness={0.18} roughness={0.18} /></mesh>
      <mesh position={[0, 0, scale[2] / 2 + 0.03]}><boxGeometry args={[0.035, scale[1] * 0.78, 0.018]} /><meshStandardMaterial color="#f7fbfd" /></mesh>
    </group>
  );
}

function Door({ position, double = false }: { position: [number, number, number]; double?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={[double ? 1.65 : 1.05, 1.95, 0.13]} /><meshStandardMaterial color="#6f432d" roughness={0.68} /></mesh>
      <mesh position={[double ? 0.58 : 0.35, 0, 0.085]}><sphereGeometry args={[0.055, 12, 12]} /><meshStandardMaterial color="#e9c46a" metalness={0.8} /></mesh>
    </group>
  );
}

function SolarPanel() {
  return (
    <group>
      <mesh position={[0, -0.025, 0]} castShadow><boxGeometry args={[0.78, 0.055, 0.9]} /><meshStandardMaterial color="#d7e1e8" metalness={0.62} roughness={0.3} /></mesh>
      <mesh position={[0, 0.012, 0]} castShadow><boxGeometry args={[0.715, 0.035, 0.835]} /><meshStandardMaterial color="#0c3156" metalness={0.42} roughness={0.18} /></mesh>
      <mesh position={[0, 0.034, 0]}><boxGeometry args={[0.018, 0.008, 0.79]} /><meshBasicMaterial color="#6faed5" /></mesh>
      <mesh position={[0, 0.034, 0]}><boxGeometry args={[0.67, 0.008, 0.018]} /><meshBasicMaterial color="#6faed5" /></mesh>
    </group>
  );
}

function PanelArray({ panelCount, columns, position, rotation = [-0.22, 0, 0], maxVisible = 36 }: { panelCount: number; columns: number; position: [number, number, number]; rotation?: [number, number, number]; maxVisible?: number }) {
  const panels = useMemo(() => {
    const count = Math.min(panelCount, maxVisible);
    const rows = Math.ceil(count / columns);
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      x: (index % columns - (columns - 1) / 2) * 0.86,
      z: (Math.floor(index / columns) - (rows - 1) / 2) * 0.98,
    }));
  }, [columns, maxVisible, panelCount]);
  return <group position={position} rotation={rotation}>{panels.map((panel) => <group key={panel.id} position={[panel.x, 0, panel.z]}><SolarPanel /></group>)}</group>;
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.15, 0.22, 2.1, 10]} /><meshStandardMaterial color="#79553b" /></mesh>
      <mesh position={[0, 2.25, 0]} castShadow><icosahedronGeometry args={[1.05, 1]} /><meshStandardMaterial color="#3e8d55" roughness={0.92} /></mesh>
      <mesh position={[0.55, 2.05, 0.18]} castShadow><icosahedronGeometry args={[0.72, 1]} /><meshStandardMaterial color="#57a963" roughness={0.92} /></mesh>
      <mesh position={[-0.45, 2.1, -0.22]} castShadow><icosahedronGeometry args={[0.76, 1]} /><meshStandardMaterial color="#4c9b5c" roughness={0.92} /></mesh>
    </group>
  );
}

function Shrub({ position, color = "#5eaa55" }: { position: [number, number, number]; color?: string }) {
  return <mesh position={position} castShadow><sphereGeometry args={[0.42, 12, 9]} /><meshStandardMaterial color={color} roughness={1} /></mesh>;
}

function Fence() {
  const sidePosts = [-7.5, -5, -2.5, 2.5, 5, 7.5];
  return (
    <group>
      {sidePosts.map((x) => <mesh key={`front-${x}`} position={[x, 0.55, 7]} castShadow><boxGeometry args={[0.13, 1.1, 0.13]} /><meshStandardMaterial color="#f3f0e8" /></mesh>)}
      {[-7.5, 7.5].flatMap((x) => [-5, -2.5, 0, 2.5, 5].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.55, z]} castShadow><boxGeometry args={[0.13, 1.1, 0.13]} /><meshStandardMaterial color="#f3f0e8" /></mesh>))}
      <mesh position={[-5.05, 0.68, 7]}><boxGeometry args={[4.9, 0.1, 0.1]} /><meshStandardMaterial color="#f3f0e8" /></mesh>
      <mesh position={[5.05, 0.68, 7]}><boxGeometry args={[4.9, 0.1, 0.1]} /><meshStandardMaterial color="#f3f0e8" /></mesh>
    </group>
  );
}

function EnergyEquipment({ wantsBattery, position = [4.4, 0.75, 1.8] as [number, number, number] }: { wantsBattery: boolean; position?: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={[0.72, 1.35, 0.42]} /><meshStandardMaterial color="#f3f6f8" metalness={0.15} roughness={0.4} /></mesh>
      <mesh position={[0, 0.25, 0.225]}><boxGeometry args={[0.38, 0.16, 0.025]} /><meshStandardMaterial color="#2c536f" emissive="#102b3b" /></mesh>
      <mesh position={[0, -0.14, 0.228]}><boxGeometry args={[0.26, 0.025, 0.025]} /><meshBasicMaterial color="#34c978" /></mesh>
      {wantsBattery ? <group position={[0.88, -0.1, 0]}><mesh castShadow><boxGeometry args={[0.72, 1.15, 0.5]} /><meshStandardMaterial color="#dce5e9" metalness={0.2} /></mesh><mesh position={[0, 0.18, 0.265]}><boxGeometry args={[0.34, 0.13, 0.02]} /><meshBasicMaterial color="#28a66a" /></mesh></group> : null}
    </group>
  );
}

function Townhouse({ panelCount, wantsBattery }: { panelCount: number; wantsBattery: boolean }) {
  return (
    <group>
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow><boxGeometry args={[5.2, 4.4, 5.7]} /><meshStandardMaterial color="#f5efe4" roughness={0.78} /></mesh>
      <mesh position={[0, 4.47, 0]} castShadow><boxGeometry args={[5.55, 0.18, 6]} /><meshStandardMaterial color="#d8d0c3" /></mesh>
      <mesh position={[-1.72, 3.1, 2.91]} castShadow><boxGeometry args={[1.45, 2.25, 0.2]} /><meshStandardMaterial color="#ad5e3f" /></mesh>
      <Door position={[-1.72, 1, 2.96]} />
      <Window position={[0.65, 1.25, 2.91]} scale={[1.55, 1.05, 0.12]} />
      <Window position={[0.65, 3.15, 2.91]} scale={[1.55, 1.05, 0.12]} />
      <mesh position={[0.65, 2.52, 3.18]} castShadow><boxGeometry args={[2.35, 0.12, 0.75]} /><meshStandardMaterial color="#d9dde0" /></mesh>
      <mesh position={[0.65, 2.9, 3.52]}><boxGeometry args={[2.2, 0.75, 0.06]} /><meshStandardMaterial color="#8dc4d5" transparent opacity={0.62} /></mesh>
      <PanelArray panelCount={panelCount} columns={5} position={[0, 4.72, -0.1]} rotation={[-0.16, 0, 0]} maxVisible={20} />
      <EnergyEquipment wantsBattery={wantsBattery} position={[3.05, 0.75, 1.7]} />
    </group>
  );
}

function Villa({ panelCount, wantsBattery }: { panelCount: number; wantsBattery: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow><boxGeometry args={[8.2, 3.1, 5.8]} /><meshStandardMaterial color="#f2eadb" roughness={0.82} /></mesh>
      <mesh position={[0, 3.45, -0.25]} castShadow><boxGeometry args={[5.8, 1.25, 4.8]} /><meshStandardMaterial color="#fbf7ef" roughness={0.76} /></mesh>
      <mesh position={[0, 4.65, -0.15]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.55, 1.9, 4]} /><meshStandardMaterial color="#92503d" roughness={0.74} /></mesh>
      <mesh position={[0, 0.4, 3.65]} castShadow><boxGeometry args={[8.8, 0.22, 1.4]} /><meshStandardMaterial color="#e1ded4" /></mesh>
      {[-3.35, 3.35].map((x) => <mesh key={x} position={[x, 1.35, 3.35]} castShadow><cylinderGeometry args={[0.16, 0.2, 2.7, 16]} /><meshStandardMaterial color="#f8f4ec" /></mesh>)}
      <Door position={[0, 1.05, 2.96]} double />
      {[-2.65, 2.65].map((x) => <Window key={`low-${x}`} position={[x, 1.45, 2.96]} scale={[1.45, 1.1, 0.12]} />)}
      {[-1.75, 1.75].map((x) => <Window key={`high-${x}`} position={[x, 3.5, 2.21]} scale={[1.2, 0.88, 0.12]} />)}
      <PanelArray panelCount={panelCount} columns={6} position={[0, 5.05, -0.35]} rotation={[-0.38, 0, 0]} maxVisible={24} />
      <EnergyEquipment wantsBattery={wantsBattery} position={[4.65, 0.75, 1.25]} />
    </group>
  );
}

function GardenHouse({ panelCount, wantsBattery }: { panelCount: number; wantsBattery: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow><boxGeometry args={[7.4, 2.7, 5.4]} /><meshStandardMaterial color="#efe8d8" roughness={0.85} /></mesh>
      <mesh position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.65, 2.15, 4]} /><meshStandardMaterial color="#8b4b37" roughness={0.8} /></mesh>
      <mesh position={[0, 0.45, 3.55]} castShadow><boxGeometry args={[8.3, 0.22, 1.7]} /><meshStandardMaterial color="#cbbda5" /></mesh>
      {[-3.2, 3.2].map((x) => <mesh key={x} position={[x, 1.45, 3.25]} castShadow><cylinderGeometry args={[0.12, 0.15, 2.5, 12]} /><meshStandardMaterial color="#f8f2e6" /></mesh>)}
      <Door position={[0, 1.05, 2.76]} double />
      {[-2.45, 2.45].map((x) => <Window key={x} position={[x, 1.35, 2.76]} scale={[1.45, 1.0, 0.12]} />)}
      <PanelArray panelCount={panelCount} columns={6} position={[0, 3.95, -0.25]} rotation={[-0.4, 0, 0]} maxVisible={24} />
      <EnergyEquipment wantsBattery={wantsBattery} position={[4.2, 0.72, 1.4]} />
    </group>
  );
}

function BusinessBuilding({ panelCount, wantsBattery }: { panelCount: number; wantsBattery: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow><boxGeometry args={[9.6, 3.6, 6.6]} /><meshStandardMaterial color="#dfe5e7" metalness={0.08} roughness={0.65} /></mesh>
      <mesh position={[0, 3.72, 0]} rotation={[-0.045, 0, 0]} castShadow><boxGeometry args={[10, 0.2, 7]} /><meshStandardMaterial color="#879aa3" metalness={0.3} roughness={0.45} /></mesh>
      <mesh position={[-2.75, 1.4, 3.36]} castShadow><boxGeometry args={[3.35, 2.65, 0.18]} /><meshStandardMaterial color="#466776" metalness={0.35} /></mesh>
      <mesh position={[1.8, 2.25, 3.4]} castShadow><boxGeometry args={[4.2, 1.15, 0.2]} /><meshStandardMaterial color="#f5f6f6" /></mesh>
      <mesh position={[1.8, 2.25, 3.52]}><boxGeometry args={[3.75, 0.72, 0.04]} /><meshStandardMaterial color="#3282a1" /></mesh>
      <PanelArray panelCount={panelCount} columns={8} position={[0, 4.05, -0.1]} rotation={[-0.12, 0, 0]} maxVisible={36} />
      <EnergyEquipment wantsBattery={wantsBattery} position={[5.3, 0.8, 1.65]} />
    </group>
  );
}

function Landscape({ propertyType }: { propertyType: PropertyType }) {
  const trees: Array<[number, number, number, number]> = propertyType === "business"
    ? [[-7, 0, -4.8, 0.8], [7, 0, -4.8, 0.8], [-7, 0, 3.5, 0.7]]
    : [[-6.3, 0, -4.5, 1], [6.1, 0, -4.2, 0.9], [-6.2, 0, 3.4, 0.75], [6.15, 0, 3.7, 0.72]];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow><planeGeometry args={[32, 32]} /><meshStandardMaterial color="#a8d098" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 8.2]} receiveShadow><planeGeometry args={[32, 4.2]} /><meshStandardMaterial color="#7b8185" roughness={0.96} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 5.4]} receiveShadow><planeGeometry args={[propertyType === "business" ? 8 : 3.2, 5.8]} /><meshStandardMaterial color={propertyType === "business" ? "#b5b9ba" : "#d7c7a9"} roughness={0.92} /></mesh>
      {trees.map(([x, y, z, scale]) => <Tree key={`${x}-${z}`} position={[x, y, z]} scale={scale} />)}
      {[-4.4, -3.5, 3.5, 4.4].map((x, index) => <Shrub key={x} position={[x, 0.35, 5.15]} color={index % 2 ? "#4e9d58" : "#68b35d"} />)}
      {propertyType !== "business" ? <><Fence /><mesh position={[-4.9, 0.22, -1.1]}><cylinderGeometry args={[1.65, 1.65, 0.18, 40]} /><meshStandardMaterial color="#5ba9bc" metalness={0.12} roughness={0.25} /></mesh><mesh position={[-4.9, 0.05, -1.1]}><cylinderGeometry args={[1.95, 1.95, 0.18, 40]} /><meshStandardMaterial color="#d9c7a6" /></mesh></> : null}
      <mesh position={[0, 0.07, 10.25]}><boxGeometry args={[32, 0.08, 0.18]} /><meshBasicMaterial color="#f5d657" /></mesh>
    </group>
  );
}

function ArchitecturalScene({ propertyType, roofSize, panelCount, wantsBattery }: { propertyType: PropertyType; roofSize: RoofSize; panelCount: number; wantsBattery: boolean }) {
  const siteScale = roofSize === "small" ? 0.9 : roofSize === "large" ? 1.08 : 1;
  return (
    <group scale={[siteScale, siteScale, siteScale]} rotation={[0, -0.12, 0]}>
      {propertyType === "townhouse" ? <Townhouse panelCount={panelCount} wantsBattery={wantsBattery} /> : null}
      {propertyType === "villa" ? <Villa panelCount={panelCount} wantsBattery={wantsBattery} /> : null}
      {propertyType === "garden" ? <GardenHouse panelCount={panelCount} wantsBattery={wantsBattery} /> : null}
      {propertyType === "business" ? <BusinessBuilding panelCount={panelCount} wantsBattery={wantsBattery} /> : null}
    </group>
  );
}

export function CitizenSolarScene({ propertyType, roofSize, panelCount, wantsBattery }: { propertyType: PropertyType; roofSize: RoofSize; panelCount: number; wantsBattery: boolean }) {
  const [view, setView] = useState<SceneView>("perspective");
  return (
    <div className="relative h-[520px] overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-b from-sky-100 to-emerald-50 shadow-sm">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-white/70 bg-white/95 px-3 py-2.5 text-xs text-slate-600 shadow-md backdrop-blur">
        <strong className="block text-sm text-slate-800">{PROPERTY_LABELS[propertyType]}</strong>
        <span>{ROOF_LABELS[roofSize]} · {panelCount} tấm pin</span>
        <span className="mt-1 block text-[10px]">Kéo để xoay · lăn chuột để phóng to</span>
      </div>
      <div className="absolute right-3 top-3 z-10 flex rounded-lg border border-white/70 bg-white/95 p-1 shadow-md backdrop-blur">
        {VIEWS.map((item) => <button key={item.value} type="button" onClick={() => setView(item.value)} className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition", view === item.value ? "bg-gov text-white" : "text-slate-600 hover:bg-slate-100")}>{item.label}</button>)}
      </div>
      <Canvas
        shadows
        camera={{ position: [11.5, 8.5, 13], fov: 43, near: 0.1, far: 120 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        fallback={<SceneFallback />}
      >
        <color attach="background" args={["#dff3ff"]} />
        <fog attach="fog" args={["#dff3ff", 25, 52]} />
        <hemisphereLight args={["#eaf8ff", "#486b3c", 1.85]} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[9, 13, 7]} intensity={2.35} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
        <mesh position={[-8, 11, -12]}><sphereGeometry args={[0.8, 24, 24]} /><meshBasicMaterial color="#ffd45c" /></mesh>
        <Landscape propertyType={propertyType} />
        <ArchitecturalScene propertyType={propertyType} roofSize={roofSize} panelCount={panelCount} wantsBattery={wantsBattery} />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.42} scale={24} blur={2.4} far={12} />
        <CameraRig view={view} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={25} maxPolarAngle={Math.PI / 2.04} target={[0, 1.65, 0]} />
      </Canvas>
      {panelCount > 36 ? <span className="absolute bottom-3 right-3 rounded-md bg-navy/85 px-2.5 py-1 text-xs font-semibold text-white">Mô phỏng 36/{panelCount} tấm · đủ công suất tính toán</span> : null}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-[10px] text-slate-600 shadow-sm">Mô hình ý tưởng · cần khảo sát kiến trúc và kết cấu trước khi thi công</div>
    </div>
  );
}

function SceneFallback() {
  return <div className="grid h-full place-items-center bg-gradient-to-b from-sky-100 to-emerald-50 p-8 text-center text-sm text-slate-600">Trình duyệt chưa bật WebGL. Vui lòng bật tăng tốc phần cứng để xem mô hình kiến trúc 3D.</div>;
}
