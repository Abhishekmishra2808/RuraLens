import { useAppStore } from '../../store/appStore';

export default function LiveCharts() {
  // Keep store reference to avoid linting errors
  useAppStore();

  return (
    <div className="space-y-4">
      {/* Charts removed - Water Infrastructure and Power Grid sections deleted */}
    </div>
  );
}
