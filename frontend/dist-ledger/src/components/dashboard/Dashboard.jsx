import { useState, useEffect, useContext } from 'react';
import { RoleContext } from '../../context/RoleContext';
import { fetchDashboardStats } from '../../services/dashboardService';
import SystemOverview from './SystemOverview';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';
import { FaSync } from 'react-icons/fa';

const Dashboard = ({ setCurrentView }) => {
  const { currentRole } = useContext(RoleContext);
  const [stats, setStats] = useState({
    distributor: { productCount: '--', transactionCount: '--' },
    retailer: { productCount: '--', salesCount: '--' },
    main: { verifiedProducts: '--', eventsCount: '--' },
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardStats();
      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentRole]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-300">
        <h2 className="text-2xl font-bold">Enterprise Dashboard</h2>
        <button 
          className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          onClick={loadDashboardData}
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SystemOverview 
          stats={stats} 
          currentRole={currentRole}
          loading={loading}
        />
        
        <div className="card">
          <div className="card-header">Recent Activity</div>
          <div className="card-body">
            <RecentActivity 
              activities={stats.recentActivity} 
              loading={loading} 
              currentRole={currentRole}
            />
          </div>
        </div>
      </div>
      
      <QuickActions setCurrentView={setCurrentView} />
    </div>
  );
};

export default Dashboard;
