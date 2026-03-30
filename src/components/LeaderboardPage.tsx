import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import CommunityLeaderboard from './CommunityLeaderboard';

interface LeaderboardPageProps {
  currentUserId?: string;
}

export default function LeaderboardPage({ currentUserId }: LeaderboardPageProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);

  const fetchReports = async () => {
    setIsRefreshing(true);
    try {
      // Try with reportedAt first (what reports actually use)
      let reportsQuery;
      try {
        reportsQuery = query(
          collection(db, 'reports'),
          orderBy('reportedAt', 'desc'),
          limit(1000)
        );
      } catch (err) {
        console.warn('[LeaderboardPage] reportedAt ordering failed, trying without order:', err);
        // Fallback: fetch without ordering
        reportsQuery = query(
          collection(db, 'reports'),
          limit(1000)
        );
      }

      const snapshot = await getDocs(reportsQuery);
      const allReports = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
        };
      });
      console.log(`[LeaderboardPage] Fetched ${allReports.length} reports from Firestore`);
      if (allReports.length > 0) {
        console.log('[LeaderboardPage] Sample report structure:', JSON.stringify(allReports[0], null, 2));
      }
      setReports(allReports);
    } catch (error) {
      console.error('[LeaderboardPage] Fetch error:', error);
      handleFirestoreError(error, OperationType.GET, 'reports');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <CommunityLeaderboard 
      reports={reports} 
      currentUserId={currentUserId}
      onRefresh={fetchReports}
      isRefreshing={isRefreshing}
    />
  );
}
