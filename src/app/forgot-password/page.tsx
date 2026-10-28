import { Suspense } from "react";
import ForgotPasswordForm from "./forgot-password-form";

async function Content({ searchParams }: Pick<PageProps<"/forgot-password">, "searchParams">) {
  const { expired } = await searchParams;
  return <ForgotPasswordForm expired={Boolean(expired)} />;
}

export default function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
