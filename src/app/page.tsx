import LoginForm from '@/components/LoginForm';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
      <div className="w-[480px] p-8 bg-white rounded-[32px] shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-[28px] font-bold text-[#005B96]">
            Sales Monitoring System
          </h1>
          <p className="mt-2 text-sky-500">
            Please sign in to your account
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
