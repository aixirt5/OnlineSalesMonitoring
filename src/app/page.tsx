import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-sky-200 to-sky-300">
      <div className="max-w-md w-full space-y-8 p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-sky-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-sky-800 tracking-tight">
            Sales Monitoring System
          </h2>
          <p className="mt-2 text-center text-sm text-sky-600">
            Please sign in to your account
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
