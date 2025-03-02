import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

const RecentActivity = ({ activities, loading, currentRole }) => {
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No recent activity found
      </div>
    );
  }
  
  // Filter activities based on role permissions
  const filteredActivities = activities.filter(activity => {
    if (currentRole === 'admin') return true;
    if (activity.chain === 'distributor-chain' && currentRole !== 'distributor') return false;
    if (activity.chain === 'retailer-chain' && currentRole !== 'retailer') return false;
    return true;
  });
  
  if (filteredActivities.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No activities available for your role
      </div>
    );
  }
  
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {filteredActivities.map((activity, index) => {
        const time = new Date(activity.timestamp).toLocaleTimeString();
        const chainClass = activity.chain.includes('distributor') 
          ? 'bg-distributor' 
          : activity.chain.includes('retailer') 
            ? 'bg-retailer' 
            : 'bg-main';
            
        return (
          <div key={index} className="flex gap-3 pb-3 border-b border-gray-100">
            <div className={`${chainClass} w-6 h-6 rounded-full flex-shrink-0 mt-1`}></div>
            <div className="flex-grow">
              <div className="flex justify-between text-sm">
                <span className="font-bold">{activity.type}</span>
                <span className="text-gray-500">{time}</span>
              </div>
              <div className="text-gray-700">{activity.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentActivity;
