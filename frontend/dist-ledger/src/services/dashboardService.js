import { apiRequest } from './api';

export const fetchDashboardStats = () => 
  apiRequest('/dashboard/stats');

export const fetchRecentActivity = () =>
  apiRequest('/dashboard/activity');
