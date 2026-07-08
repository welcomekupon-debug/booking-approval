import { SignIn } from "@clerk/nextjs";
import { AuthPanel } from "@/components/AuthPanel";

export default function SignInPage() {
  return (
    <AuthPanel>
      <SignIn />
    </AuthPanel>
  );
}
