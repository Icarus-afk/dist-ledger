import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import VerificationLayout from './layouts/VerificationLayout';

// Pages
import Dashboard from './pages/dashboard/Index';

// Manufacturer pages
import ManufacturerProducts from './pages/manufacturer/Products';
import RegisterProduct from './pages/manufacturer/RegisterProduct'; // Fixed the import name

// Distributor pages
import Inventory from './pages/distributor/Inventory';
import Shipments from './pages/distributor/Shipments';
import Returns from './pages/distributor/Returns';
// Retailer pages
import RetailerInventory from './pages/retailer/Inventory';
import RetailerSales from './pages/retailer/Sales';
import RetailerReturns from './pages/retailer/Returns';

// Verification page
import VerifyProduct from './pages/verification/VerifyProduct';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Unauthorized from './pages/auth/UnAuthorized';

// Import auth context/hook
import { useAuth } from './context/AuthContext';

// Role-based Route Protection Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, userRole, loading } = useAuth();
  const location = useLocation();

  // While checking authentication status, show loading or nothing
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // If authenticated but not authorized for this route
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If all checks pass, render the children
  return children;
};

// Public route that redirects authenticated users away from login/register
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // If already authenticated, redirect to dashboard or the page they were trying to access
  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
};

// Home redirect based on user role
const HomeRedirect = () => {
  const { isAuthenticated, userRole, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Redirect to role-specific dashboard
  switch (userRole) {
    case 'manufacturer':
      return <Navigate to="/manufacturer/dashboard" replace />;
    case 'distributor':
      return <Navigate to="/distributor/dashboard" replace />;
    case 'retailer':
      return <Navigate to="/retailer/dashboard" replace />;
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Home route with role-based redirection */}
      <Route path="/" element={<HomeRedirect />} />
      
      {/* Auth routes - available to non-authenticated users */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>
      
      {/* Unauthorized route */}
      <Route path="/unauthorized" element={
        <AuthLayout>
          <Unauthorized />
        </AuthLayout>
      } />

      {/* Main dashboard route */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Manufacturer Routes */}
      <Route path="/manufacturer" element={
        <ProtectedRoute allowedRoles={['manufacturer', 'admin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<ManufacturerProducts />} />
        <Route path="register-product" element={<RegisterProduct />} />
      </Route>

      {/* Distributor Routes */}
      <Route path="/distributor" element={
        <ProtectedRoute allowedRoles={['distributor', 'admin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="returns" element={<Returns />} />
      </Route>

      {/* Retailer Routes */}
      <Route path="/retailer" element={
        <ProtectedRoute allowedRoles={['retailer', 'admin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<RetailerInventory />} />
        <Route path="sales" element={<RetailerSales />} />
        <Route path="returns" element={<RetailerReturns />} />
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
      </Route>

      {/* Verification Routes - Public */}
      <Route path="/verification" element={<VerificationLayout />}>
        <Route path="product" element={<VerifyProduct />} />
      </Route>

      {/* Catch-all route */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center p-8 text-center bg-neutral-50">
          <div>
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-neutral-600 mb-4">The page you are looking for doesn't exist.</p>
            <a href="/" className="text-primary-600 hover:text-primary-800">
              Go back to home page
            </a>
          </div>
        </div>
      } />
    </Routes>
  );
};

export default AppRoutes;