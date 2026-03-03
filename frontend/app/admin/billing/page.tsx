'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/invoices');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0f766e] border-t-transparent" />
    </div>
  );
}
