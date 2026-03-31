import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';

interface ProtectedRouteProps {
  user: UserProfile | null;
  loading: boolean;
  requiredRole?: 'admin' | 'citizen';
  children: React.ReactNode;
}

export default function ProtectedRoute({ user, loading, requiredRole, children }: ProtectedRouteProps) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to home if not logged in
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check if account is suspended
  if (user.enabled === false) {
    return <Navigate to="/suspended" replace />;
  }

  // Check for role-based access
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to unauthorized page if role doesn't match
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
