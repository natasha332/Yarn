import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/business";
import OnboardingForm from "./onboarding-form";

async function Gate() {
  // Already set up? Skip straight to the app.
  if (await getMyBusiness()) redirect("/");
  return <OnboardingForm />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
