"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartCard } from "@/components/common/ChartCard";
import { createDossier, updateDossier } from "@/lib/industrial-clusters/industrial-cluster-service";
import type { ClusterDossier } from "@/lib/industrial-clusters/industrial-cluster-types";

export function IndustrialClusterForm({
  mode,
  cluster,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  cluster?: ClusterDossier;
  onClose: () => void;
  onSave: (cluster: ClusterDossier) => void;
}) {
  const [name, setName] = useState(cluster?.name ?? "");
  const [district, setDistrict] = useState(cluster?.district ?? "");
  const [ward, setWard] = useState(cluster?.ward ?? "");
  const [area, setArea] = useState(String(cluster?.area ?? ""));
  const [sectors, setSectors] = useState(cluster?.sectors ?? "");

  const save = () => {
    const data = { name, district, ward, area: Number(area) || 0, sectors };
    const saved = mode === "edit" && cluster ? updateDossier(cluster.id, data) : createDossier(data);
    if (saved) onSave(saved);
  };

  return (
    <ChartCard title={mode === "edit" ? "Chỉnh sửa hồ sơ CCN" : "Tạo hồ sơ CCN mới"} subtitle="Thông tin cơ bản của cụm công nghiệp">
      <div className="grid gap-4 p-2 sm:grid-cols-2">
        <Field label="Tên cụm công nghiệp" value={name} onChange={setName} required />
        <Field label="Huyện/Thị xã" value={district} onChange={setDistrict} />
        <Field label="Xã/Phường" value={ward} onChange={setWard} />
        <Field label="Diện tích (ha)" value={area} onChange={setArea} type="number" />
        <div className="sm:col-span-2"><Field label="Ngành nghề" value={sectors} onChange={setSectors} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={!name.trim()}>Lưu hồ sơ</Button>
        </div>
      </div>
    </ChartCard>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="space-y-1.5 text-sm font-medium text-navy">{label}{required ? " *" : ""}<Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
