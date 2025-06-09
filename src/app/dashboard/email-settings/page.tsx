'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SMTPSettings from '@/components/SMTPSettings';

export default function EmailSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const setupUserId = searchParams.get('userId');
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        if (isSetup && setupUserId) {
          // If we're in setup mode, use the provided userId
          setUserId(parseInt(setupUserId));
          setLoading(false);
          return;
        }

        // Otherwise, get the current user's ID from the session
        const { data: user, error } = await supabase
          .from('myusers')
          .select('id')
          .single();

        if (error) throw error;
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error('Error getting current user:', err);
        setError('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    getCurrentUser();
  }, [isSetup, setupUserId]);

  const handleSettingsSaved = () => {
    if (isSetup) {
      // If we're in setup mode, redirect back to login
      router.push('/?emailSetup=complete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600">{error || 'User not found'}</p>
          {isSetup && (
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-sky-200 to-sky-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            {isSetup 
              ? 'Configure your email settings to complete the login process'
              : 'Configure your email settings for sending verification codes'}
          </p>
        </div>
        <SMTPSettings userId={userId} onSettingsSaved={handleSettingsSaved} />
      </div>
    </div>
  );
} 