import AdminDashboard from './AdminDashboard';
import CitizenDashboard from './CitizenDashboard';
import { useAppStore } from '../../store/appStore';

export default function Dashboard() {
  const userRole = useAppStore((state) => state.userRole);

  // Route to appropriate dashboard based on user role
  if (userRole === 'admin' || userRole === 'field_worker') {
    return <AdminDashboard />;
  }

  // Citizens and default view
  return <CitizenDashboard />;
}
