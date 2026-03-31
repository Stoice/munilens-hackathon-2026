export type Importance = 'Critical' | 'High' | 'Medium' | 'Low';
export type Province = 'Eastern Cape' | 'Free State' | 'Gauteng' | 'KwaZulu-Natal' | 'Limpopo' | 'Mpumalanga' | 'Northern Cape' | 'North West' | 'Western Cape';

export interface Report {
  id?: string;
  type: string;
  latitude: number;
  longitude: number;
  address?: string;
  photoUrl?: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  reportedAt: string;
  reporterUid: string;
  reporterName?: string;
  description?: string;
  importance?: Importance;
  routedTo?: string;
  estimatedSolution?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'citizen' | 'admin';
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  province?: Province;
  enabled: boolean;
}
