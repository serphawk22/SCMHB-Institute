"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PipelineRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/leads");
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}
