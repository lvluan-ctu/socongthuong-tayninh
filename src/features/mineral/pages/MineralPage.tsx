import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LicenseTable } from '@/features/mineral/components/LicenseTable';
import { MineralMap } from '@/features/mineral/components/MineralMap';
import { ExtractionReportTable } from '@/features/mineral/components/ExtractionReportTable';
import { MineralStatsCards } from '@/features/mineral/components/MineralStatsCards';
import { AlertCenter } from '@/features/mineral/components/AlertCenter';
import { VehicleTracking } from '@/features/mineral/components/VehicleTracking';
import { DashboardModule, KpiMiniCard } from '@/components/dashboard/DashboardModule';
import { Minimal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function MineralPage() {
  const [activeTab, setActiveTab] = useState<'licenses' | 'map' | 'reports' | 'alerts' | 'vehicles'>('licenses');
  const queryClient = useQueryClient();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Refresh data when tab changes
    if (tab === 'licenses') {
      queryClient.invalidateQueries({ queryKey: ['mineralLicenses'] });
    }
    if (tab === 'map') {
      queryClient.invalidateQueries({ queryKey: ['mineralMap'] });
    }
    if (tab === 'reports') {
      queryClient.invalidateQueries({ queryKey: ['mineralReports'] });
    }
    if (tab === 'alerts') {
      queryClient.invalidateQueries({ queryKey: ['mineralAlerts'] });
    }
    if (tab === 'vehicles') {
      queryClient.invalidateQueries({ queryKey: ['mineralVehicles'] });
    }
  };

  return (
    <div className="min-h-screen">
      <h2 className="text-xl font-medium mb-4">Quản lý khai thác khoáng sản</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <button
          onClick={() => setActiveTab('licenses')}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === 'licenses'}
        >
          Danh sách GP
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === 'map'}
        >
          Bản đồ
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === 'reports'}
        >
          Báo cáo khai thác
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === 'alerts'}
        >
          Cảnh báo
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className="flex-1 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-gov focus:ring-offset-background"
          aria-pressed={activeTab === 'vehicles'}
        >
          Phương tiện
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'licenses' && (
        <LicenseTable
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mineralLicenses'] })}
        />
      )}

      {activeTab === 'map' && (
        <MineralMap
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mineralMap'] })}
        />
      )}

      {activeTab === 'reports' && (
        <ExtractionReportTable
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mineralReports'] })}
        />
      )}

      {activeTab === 'alerts' && (
        <AlertCenter
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mineralAlerts'] })}
        />
      )}

      {activeTab === 'vehicles' && (
        <VehicleTracking
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mineralVehicles'] })}
        />
      )}
    </div>
  );
}