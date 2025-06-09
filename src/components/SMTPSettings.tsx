'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SMTPSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
}

interface Props {
  userId: number;
  onSettingsSaved?: () => void;
}

export default function SMTPSettings({ userId, onSettingsSaved }: Props) {
  const [settings, setSettings] = useState<SMTPSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('myusers')
        .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error loading SMTP settings:', err);
      setError('Failed to load SMTP settings');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { error } = await supabase
        .from('myusers')
        .update({
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_user: settings.smtp_user,
          smtp_pass: settings.smtp_pass,
          smtp_from: settings.smtp_from || settings.smtp_user
        })
        .eq('id', userId);

      if (error) throw error;
      setMessage('SMTP settings saved successfully');
      onSettingsSaved?.();
    } catch (err) {
      console.error('Error saving SMTP settings:', err);
      setError('Failed to save SMTP settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Email Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="smtp_host" className="block text-sm font-medium text-gray-700">
            SMTP Host
          </label>
          <input
            type="text"
            id="smtp_host"
            value={settings.smtp_host}
            onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g., smtp.gmail.com"
            required
          />
        </div>

        <div>
          <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700">
            SMTP Port
          </label>
          <input
            type="number"
            id="smtp_port"
            value={settings.smtp_port}
            onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="587 or 465"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Common ports: 587 (TLS) or 465 (SSL)
          </p>
        </div>

        <div>
          <label htmlFor="smtp_user" className="block text-sm font-medium text-gray-700">
            SMTP Username
          </label>
          <input
            type="text"
            id="smtp_user"
            value={settings.smtp_user}
            onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="your.email@gmail.com"
            required
          />
        </div>

        <div>
          <label htmlFor="smtp_pass" className="block text-sm font-medium text-gray-700">
            SMTP Password
          </label>
          <input
            type="password"
            id="smtp_pass"
            value={settings.smtp_pass}
            onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Your app password"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            For Gmail, use an App Password generated from your Google Account settings
          </p>
        </div>

        <div>
          <label htmlFor="smtp_from" className="block text-sm font-medium text-gray-700">
            From Email (optional)
          </label>
          <input
            type="email"
            id="smtp_from"
            value={settings.smtp_from}
            onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Same as SMTP Username if left empty"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {message && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-md">
          {message}
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
} 