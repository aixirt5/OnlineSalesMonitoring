import { createClient } from '@supabase/supabase-js';

export const getSalesDb = () => {
  const projectUrl = localStorage.getItem('projectUrl');
  const projectKey = localStorage.getItem('projectKey');

  if (!projectUrl || !projectKey) {
    throw new Error('Sales database credentials not found');
  }

  return createClient(projectUrl, projectKey);
}; 