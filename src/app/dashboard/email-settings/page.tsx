import { Suspense } from 'react';
import EmailSettingsContent from './EmailSettingsContent';

export default function EmailSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <EmailSettingsContent />
    </Suspense>
  );
} 