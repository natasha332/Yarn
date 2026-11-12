import { Suspense } from "react";
import { requireBusiness } from "@/lib/business";
import Tour from "./tour";

// The "How Yarn works" tour. Shown once after setting up, and always available from Settings.
async function Gate() {
  await requireBusiness();
  return <Tour />;
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
