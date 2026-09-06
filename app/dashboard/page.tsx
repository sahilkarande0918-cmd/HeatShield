import type { Metadata } from 'next';
import Dashboard from '@/components/dashboard/Dashboard';
import { DEFAULT_CITY } from '@/lib/cities';

export const metadata: Metadata = {
  title: 'HeatShield — live risk map',
};

export default function DashboardPage() {
  return <Dashboard initialCity={DEFAULT_CITY.key} />;
}
